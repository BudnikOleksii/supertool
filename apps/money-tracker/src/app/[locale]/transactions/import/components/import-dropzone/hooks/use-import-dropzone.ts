import type { ChangeEvent, DragEvent } from 'react';

import { useRef, useState } from 'react';

const FIRST_FILE_INDEX = 0;

interface UseImportDropzoneParams {
  disabled: boolean;
  onFileSelect: (file: File) => void;
}

export const useImportDropzone = ({ disabled, onFileSelect }: UseImportDropzoneParams) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleBrowseClick = () => {
    inputRef.current?.click();
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[FIRST_FILE_INDEX];

    event.target.value = '';

    if (selectedFile) {
      onFileSelect(selectedFile);
    }
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();

    if (!disabled) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);

    if (disabled) {
      return;
    }

    const droppedFile = event.dataTransfer.files[FIRST_FILE_INDEX];

    if (droppedFile) {
      onFileSelect(droppedFile);
    }
  };

  return {
    inputRef,
    isDragOver,
    handleBrowseClick,
    handleInputChange,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
};
