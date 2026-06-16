import type { RefObject } from 'react';

import { useEffect } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';
const EMPTY_LENGTH = 0;
const LAST_INDEX = -1;

const getFocusableList = (container: HTMLElement): HTMLElement[] => [
  ...container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
];

const focusFirst = (drawer: HTMLElement): void => {
  const [first] = getFocusableList(drawer);
  (first ?? drawer).focus();
};

const wrapFocus = (event: KeyboardEvent, focusableList: HTMLElement[]): void => {
  const [first] = focusableList;
  const last = focusableList.at(LAST_INDEX);
  const { activeElement } = document;

  if (event.shiftKey && activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
};

const trapTab = (event: KeyboardEvent, drawer: HTMLElement): void => {
  const focusableList = getFocusableList(drawer);

  if (focusableList.length === EMPTY_LENGTH) {
    event.preventDefault();
    drawer.focus();
    return;
  }

  wrapFocus(event, focusableList);
};

export const useDrawerModal = (
  isActive: boolean,
  drawerRef: RefObject<HTMLElement | null>,
): void => {
  useEffect(() => {
    const drawer = drawerRef.current;

    if (!isActive || drawer === null) {
      return;
    }

    const previouslyFocused = document.activeElement;
    const previousBodyOverflow = document.body.style.overflow;

    document.body.style.overflow = 'hidden';
    focusFirst(drawer);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        trapTab(event, drawer);
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;

      if (previouslyFocused instanceof HTMLElement) {
        previouslyFocused.focus();
      }
    };
  }, [isActive, drawerRef]);
};
