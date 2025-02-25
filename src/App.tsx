import './styles.css';
import { useLayoutEffect, useRef, useState, useEffect, useCallback } from 'react';
import { Spin, message } from 'antd';
import { fileNames } from './fileNames';

const defaultLeft = 10;
const defaultTop = 10;
// const thumbnailAreaWidth = 300;

const downloadAndParseImageFact = () => {
  const tempcanvas = document.createElement('canvas');
  const tempctx = tempcanvas.getContext('2d', { willReadFrequently: true })!;
  return async (url: string) => {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(
          `Failed to download image from ${url}: ${response.statusText}`
        );
      }
      const blob = await response.blob();
      const imageBitmap = await createImageBitmap(blob);
      const {width, height} = imageBitmap;
      tempcanvas.width = width;
      tempcanvas.height = height;
      tempctx!.drawImage(imageBitmap, 0, 0);
      const imageData = tempctx!.getImageData(0, 0, width, height);
      return imageData
    } catch (error) {
      console.error(error);
    }
  }
}

const getCroppedImageData = (
  cropX: number,
  cropY: number,
  cropWidth: number,
  cropHeight: number,
  originalData: Uint8ClampedArray,
  originImgWidth: number
) => {
  const croppedData = new Uint8ClampedArray(cropWidth * cropHeight * 4);
  for (let y = 0; y < cropHeight; y++) {
    for (let x = 0; x < cropWidth; x++) {
      const sourceIndex = ((cropY + y) * originImgWidth + (cropX + x)) * 4;
      const targetIndex = (y * cropWidth + x) * 4;
      croppedData[targetIndex] = originalData[sourceIndex];
      croppedData[targetIndex + 1] = originalData[sourceIndex + 1];
      croppedData[targetIndex + 2] = originalData[sourceIndex + 2];
      croppedData[targetIndex + 3] = originalData[sourceIndex + 3];
    }
  }
  const croppedImageData = new ImageData(croppedData, cropWidth, cropHeight);
  return croppedImageData
}

export default function App() {
  const originAreaRef = useRef<HTMLCanvasElement | null>(null);
  const originAreaContextRef = useRef<CanvasRenderingContext2D | null>(null);
  const originImgDataRef = useRef<Uint8ClampedArray | null>(null);
  const originImgSizeRef = useRef({width: 0, height: 0});

  const thumbnailAreaRef = useRef<HTMLCanvasElement | null>(null);
  const thumbnailAreaContextRef = useRef<CanvasRenderingContext2D | null>(null);
  const thumbnailImgDataRef = useRef<ImageData | null>(null);

  const visualRangeBoxRef = useRef<HTMLDivElement | null>(null);
  const visualRangeBoxLeftRef = useRef(defaultLeft);
  const visualRangeBoxTopRef = useRef(defaultTop);
  const scaleRef = useRef<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [inited, setInited] = useState(false);

  const originAreaRender = useCallback(() => {
    const left = visualRangeBoxLeftRef.current;
    const top = visualRangeBoxTopRef.current;
    const canvas = originAreaRef.current;
    const context = originAreaContextRef.current;
    const originalData = originImgDataRef.current;
    const scale = scaleRef.current;
    if (context && canvas && originalData && scale) {
      const {width: originImgWidth} = originImgSizeRef.current;
      const cropX = Math.floor(left / scale);
      const cropY = Math.floor(top / scale);
      const cropWidth = canvas.width
      const cropHeight = canvas.height
      const croppedImageData = getCroppedImageData(cropX, cropY, cropWidth, cropHeight, originalData, originImgWidth)
      context.putImageData(croppedImageData, 0, 0);
    }
  }, []);

  const thumbnailAreaRender = useCallback((x: number, y: number, width: number, height: number) => {
    const context = thumbnailAreaContextRef.current
    const scale = scaleRef.current;
    const thumbnailImgData = thumbnailImgDataRef.current;
    if (context && scale && thumbnailImgData) {
      const cropX = Math.floor(x * scale);
      const cropY = Math.floor(y * scale);
      const {width: originImgWidth, data: originalData} = thumbnailImgData;
      const cropWidth = width * scale;
      const cropHeight = height * scale;
      const croppedImageData = getCroppedImageData(cropX, cropY, cropWidth, cropHeight, originalData, originImgWidth)
      context.putImageData(croppedImageData, cropX, cropY);
    }
  }, [])

  useLayoutEffect(() => {
    if (inited) {
      const visualRangeBox = visualRangeBoxRef.current;
      const originArea = originAreaRef.current;
      const thumbnailArea = thumbnailAreaRef.current;
      const thumbnailImgData = thumbnailImgDataRef.current;
      if (originArea && visualRangeBox && thumbnailArea && thumbnailImgData) {
        const {width: originImgWidth} = originImgSizeRef.current;
        const {width: thumbnailImgWidth, height: thumbnailImgHeight} = thumbnailImgData;
        thumbnailArea.width = thumbnailImgWidth;
        thumbnailArea.style.width = `${thumbnailImgWidth}px`;
        thumbnailArea.height = thumbnailImgHeight;
        thumbnailArea.style.height = `${thumbnailImgHeight}px`;

        const scale = thumbnailImgWidth / originImgWidth;
        scaleRef.current = scale;

        const setCanvasSize = () => {
          originArea.width = window.innerWidth;
          originArea.height = window.innerHeight;
        }
        setCanvasSize();
        window.addEventListener('resize', setCanvasSize);
        const { width: canvasWidth, height: canvasHeight } = originArea;
        const originAreaContext = originArea.getContext('2d');
        if (originAreaContext) {
          originAreaContext.fillStyle = '#000';
          originAreaContext.fillRect(0, 0, canvasWidth, canvasHeight);
          originAreaContextRef.current = originAreaContext;
        }

        const thumbnailAreaContext = thumbnailArea.getContext('2d');
        if (thumbnailAreaContext) {
          thumbnailAreaContext.fillStyle = '#000';
          thumbnailAreaContext.fillRect(0, 0, thumbnailImgWidth, thumbnailImgHeight);
          thumbnailAreaContextRef.current = thumbnailAreaContext
        }

        visualRangeBox.style.left = `${visualRangeBoxLeftRef.current}px`;
        visualRangeBox.style.top = `${visualRangeBoxTopRef.current}px`;
        visualRangeBox.style.width = `${Math.ceil(canvasWidth * scale)}px`;
        visualRangeBox.style.height = `${Math.ceil(canvasHeight * scale)}px`;
        visualRangeBox.addEventListener('mousedown', (e) => {
          const startX = e.clientX;
          const startY = e.clientY;
          const startLeft = visualRangeBox.offsetLeft;
          const startTop = visualRangeBox.offsetTop;
          const startWidth = visualRangeBox.offsetWidth;
          const startHeight = visualRangeBox.offsetHeight;
          const maxLeft = thumbnailImgWidth - startWidth;
          const maxTop = thumbnailImgHeight - startHeight;
          const mousemoveHandler = (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            const diffX = e.clientX - startX;
            const diffY = e.clientY - startY;
            let newLeft = startLeft + diffX;
            let newTop = startTop + diffY;
            if (newLeft < 0 || newLeft > maxLeft) {
              newLeft = Math.max(0, Math.min(newLeft, maxLeft));
            }
            if (newTop < 0 || newTop > maxTop) {
              newTop = Math.max(0, Math.min(newTop, maxTop));
            }
            visualRangeBox.style.left = `${newLeft}px`;
            visualRangeBox.style.top = `${newTop}px`;
            visualRangeBoxLeftRef.current = newLeft;
            visualRangeBoxTopRef.current = newTop;
            originAreaRender()
          };
          const mouseupHandler = () => {
            window.removeEventListener('mousemove', mousemoveHandler);
            window.removeEventListener('mouseup', mouseupHandler);
          };
          window.addEventListener('mousemove', mousemoveHandler);
          window.addEventListener('mouseup', mouseupHandler);
        });
        return () => {
          window.removeEventListener('resize', setCanvasSize);
        }
      }
    }
  }, [inited]);

  useEffect(() => {
    if (inited) {
      (async () => {
        const imgPaths = fileNames.map((name) => {
          const group = name.match(/part_(\d+)_(\d+)\.png/)
          return ({
            url: `./tiles/${name}`,
            x: parseInt(group?.[1] ?? '0'),
            y: parseInt(group?.[2] ?? '0'),
          })
        }).sort(() => Math.random() - 0.5);
        const {width: originImgWidth, height: originImgHeight} = originImgSizeRef.current;
        const rgbaDataArrays = new Uint8ClampedArray(originImgWidth * originImgHeight * 4).fill(0);
        originImgDataRef.current = rgbaDataArrays;
        const downloadAndParseImage = downloadAndParseImageFact();
        for (const {url, x, y} of imgPaths) {
          const imageData = await downloadAndParseImage(url);
          if (imageData) {
            const {data, height: imageHeight, width: imageWidth} = imageData
            for (let i = 0, j = 0; i < data.length; i += 4, j +=1) {
              const xInTile = j % imageHeight
              const yInTile = (j - xInTile) / imageHeight
              const xInOrigin = x + xInTile
              const yInOrigin = y + yInTile
              const originIndex = (yInOrigin * originImgWidth + xInOrigin) * 4
              rgbaDataArrays[originIndex] = data[i];
              rgbaDataArrays[originIndex + 1] = data[i + 1];
              rgbaDataArrays[originIndex + 2] = data[i + 2];
              rgbaDataArrays[originIndex + 3] = data[i + 3];
            }
            originAreaRender();
            thumbnailAreaRender(x, y, imageWidth, imageHeight);
          }
        }
      })()
    }
  }, [inited]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const downloadAndParseImage = downloadAndParseImageFact();
      const hasError = await Promise.all([
        // mock一个请求原始图片大小的接口
        (new Promise<[number, number]>((resolve) => {
          setTimeout(() => {
            resolve([19200, 10800]);
          }, 500);
        })).then(([width, height]) => {
          originImgSizeRef.current = { width, height };
          return false
        }, () => {
          return true
        }),
        downloadAndParseImage('./canvas-tile-thumbnail.png').then(imageData => {
          if (imageData) {
            thumbnailImgDataRef.current = imageData
            return false
          }
          return true
        }, () => {
          return true
        })
      ])
      if (hasError.some(error => error)) {
        message.error('init error')
      } else {
        setInited(true);
      }
      setLoading(false);
    })();
  }, []);

  return (
    <Spin spinning={loading}>
      <div className="App">
        <canvas className="originArea" ref={originAreaRef} />
        <div className="thumbnailArea">
          <div className="visualRangeBox" ref={visualRangeBoxRef}></div>
          <canvas ref={thumbnailAreaRef} />
        </div>
      </div>
    </Spin>
  );
}
