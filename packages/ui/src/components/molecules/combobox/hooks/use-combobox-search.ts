import { useCallback, useRef, useState } from 'react';

interface UseComboboxSearchConfig {
  onClose: () => void;
  onSearchChange: () => void;
}

export const useComboboxSearch = ({ onClose, onSearchChange }: UseComboboxSearchConfig) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const setSearch = useCallback(
    (value: string) => {
      setSearchText(value);
      onSearchChange();
    },
    [onSearchChange],
  );

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setIsOpen(open);
      if (!open) {
        setSearchText('');
        onClose();
      }
    },
    [onClose],
  );

  return { isOpen, setIsOpen, search: searchText, setSearch, inputRef, handleOpenChange };
};
