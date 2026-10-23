export const AVATARS = [
  {
    id: 'h01',
    label: 'Cabello ondulado',
    group: 'masculino',
  },
  {
    id: 'h02',
    label: 'Gafas redondas',
    group: 'masculino',
  },
  {
    id: 'h03',
    label: 'Sombrero pescador',
    group: 'masculino',
  },
  {
    id: 'h04',
    label: 'Bigote y cárdigan',
    group: 'masculino',
  },
  {
    id: 'h05',
    label: 'Rizos y capucha',
    group: 'masculino',
  },
  {
    id: 'h06',
    label: 'Barba corta',
    group: 'masculino',
  },
  {
    id: 'h07',
    label: 'Gorra hacia atrás',
    group: 'masculino',
  },
  {
    id: 'h08',
    label: 'Cabello recogido',
    group: 'masculino',
  },
  {
    id: 'h09',
    label: 'Flequillo claro',
    group: 'masculino',
  },
  {
    id: 'h10',
    label: 'Cabello en puntas',
    group: 'masculino',
  },
  {
    id: 'h11',
    label: 'Boina y bigote',
    group: 'masculino',
  },
  {
    id: 'h12',
    label: 'Rizos largos',
    group: 'masculino',
  },
  {
    id: 'h13',
    label: 'Afro y gafas',
    group: 'masculino',
  },
  {
    id: 'h14',
    label: 'Flequillo recto',
    group: 'masculino',
  },
  {
    id: 'h15',
    label: 'Cabello gris',
    group: 'masculino',
  },
  {
    id: 'm01',
    label: 'Melena corta',
    group: 'femenino',
  },
  {
    id: 'm02',
    label: 'Dos trenzas',
    group: 'femenino',
  },
  {
    id: 'm03',
    label: 'Rizos y gafas',
    group: 'femenino',
  },
  {
    id: 'm04',
    label: 'Coleta y lazo',
    group: 'femenino',
  },
  {
    id: 'm05',
    label: 'Sombrero y melena',
    group: 'femenino',
  },
  {
    id: 'm06',
    label: 'Cabello corto',
    group: 'femenino',
  },
  {
    id: 'm07',
    label: 'Melena ondulada',
    group: 'femenino',
  },
  {
    id: 'm08',
    label: 'Dos moños',
    group: 'femenino',
  },
  {
    id: 'm09',
    label: 'Melena clara',
    group: 'femenino',
  },
  {
    id: 'm10',
    label: 'Afro y suéter',
    group: 'femenino',
  },
  {
    id: 'm11',
    label: 'Boina y melena',
    group: 'femenino',
  },
  {
    id: 'm12',
    label: 'Trenza y gafas',
    group: 'femenino',
  },
  {
    id: 'm13',
    label: 'Flequillo y coleta',
    group: 'femenino',
  },
  {
    id: 'm14',
    label: 'Moño y gafas',
    group: 'femenino',
  },
  {
    id: 'm15',
    label: 'Ondas y diadema',
    group: 'femenino',
  },
] as const;
export type AvatarId = (typeof AVATARS)[number]['id'];
export function isAvatarId(value: unknown): value is AvatarId {
  return typeof value === 'string' && AVATARS.some((avatar) => avatar.id === value);
}
export function defaultAvatar(userId: string): AvatarId {
  const demo: Record<string, AvatarId> = {
    'teacher-elena': 'm01',
    'student-camila': 'm02',
    'student-mateo': 'h01',
    'student-lucia': 'm04',
  };
  if (demo[userId]) return demo[userId];
  const hash = [...userId].reduce(
    (total, character) => (total * 31 + character.charCodeAt(0)) >>> 0,
    0,
  );
  return AVATARS[hash % AVATARS.length].id;
}
