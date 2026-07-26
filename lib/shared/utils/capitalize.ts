export const capitalize = (str: string | null) =>
  !str ? '' : str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
