import { useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';

type DragState = {
  isDragging: boolean;
  dragged: boolean;
  startX: number;
  startScrollLeft: number;
};

const INITIAL_STATE: DragState = {
  isDragging: false,
  dragged: false,
  startX: 0,
  startScrollLeft: 0,
};

export function useHorizontalDragScroll<T extends HTMLElement = HTMLDivElement>() {
  const containerRef = useRef<T | null>(null);
  const dragStateRef = useRef<DragState>({ ...INITIAL_STATE });
  const [isDragging, setIsDragging] = useState(false);

  const onMouseDown = (event: ReactMouseEvent<T>) => {
    if (event.button !== 0) return;
    const container = containerRef.current;
    if (!container || container.scrollWidth <= container.clientWidth) return;

    dragStateRef.current.isDragging = true;
    dragStateRef.current.dragged = false;
    dragStateRef.current.startX = event.clientX;
    dragStateRef.current.startScrollLeft = container.scrollLeft;
    setIsDragging(true);
  };

  const onMouseMove = (event: ReactMouseEvent<T>) => {
    if (!dragStateRef.current.isDragging) return;
    const container = containerRef.current;
    if (!container) return;

    const deltaX = event.clientX - dragStateRef.current.startX;
    if (Math.abs(deltaX) > 4) {
      dragStateRef.current.dragged = true;
    }
    container.scrollLeft = dragStateRef.current.startScrollLeft - deltaX;
  };

  const stopDragging = () => {
    if (!dragStateRef.current.isDragging) return;
    dragStateRef.current.isDragging = false;
    setIsDragging(false);
  };

  const onClickCapture = (event: ReactMouseEvent<T>) => {
    if (!dragStateRef.current.dragged) return;
    event.preventDefault();
    event.stopPropagation();
    dragStateRef.current.dragged = false;
  };

  return {
    containerRef,
    isDragging,
    onMouseDown,
    onMouseMove,
    onMouseUp: stopDragging,
    onMouseLeave: stopDragging,
    onClickCapture,
  };
}
