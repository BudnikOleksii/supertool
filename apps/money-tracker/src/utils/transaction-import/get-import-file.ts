export const getImportFile = (formData: FormData): File | null => {
  const file = formData.get('file');

  return file instanceof File ? file : null;
};
