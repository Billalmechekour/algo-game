const avatarModules = import.meta.glob("./assets/Avatar joueurs/*.png", {
  eager: true,
  import: "default",
});

export const AVATAR_IMAGES = Object.fromEntries(
  Object.entries(avatarModules)
    .map(([path, module]) => {
      const fileName = path.split("/").pop() || "";
      const avatarId = fileName.replace(".png", "");
      return [avatarId, module];
    })
    .sort((a, b) => Number(a[0]) - Number(b[0]))
);

export const AVATAR_IDS = Object.keys(AVATAR_IMAGES);

export function getRandomAvatarId(excludedIds = []) {
  const excluded = new Set(excludedIds);
  const available = AVATAR_IDS.filter((id) => !excluded.has(id));
  const pool = available.length > 0 ? available : AVATAR_IDS;
  return pool[Math.floor(Math.random() * pool.length)];
}
