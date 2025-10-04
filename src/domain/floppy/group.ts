export const group = async ({
  shortCode,
}: {
  shortCode: string;
}) => {
  return {
    shortCode,
    sgid: "1",
    members: [],
  };
};
