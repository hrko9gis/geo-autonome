export type OsakaAreaName = 'dotonbori' | 'namba' | 'umeda' | 'castle';

export interface OsakaArea {
  name: OsakaAreaName;
  displayName: string;
  productName: string;
  priceUsd: number;
  priorityOrder: number;
  inputGmlPattern: string;
}

export interface OsakaMegaPack {
  displayName: string;
  productName: string;
  priceUsd: number;
  areas: OsakaAreaName[];
}

export const OSAKA_AREAS: readonly OsakaArea[] = [
  {
    name: 'dotonbori',
    displayName: 'Osaka Dotonbori Night Scene',
    productName: 'osaka-dotonbori-night-scene',
    priceUsd: 29,
    priorityOrder: 1,
    inputGmlPattern: 'dotonbori_*.gml',
  },
  {
    name: 'namba',
    displayName: 'Osaka Namba Scene',
    productName: 'osaka-namba-scene',
    priceUsd: 29,
    priorityOrder: 2,
    inputGmlPattern: 'namba_*.gml',
  },
  {
    name: 'umeda',
    displayName: 'Osaka Umeda Scene',
    productName: 'osaka-umeda-scene',
    priceUsd: 29,
    priorityOrder: 3,
    inputGmlPattern: 'umeda_*.gml',
  },
  {
    name: 'castle',
    displayName: 'Osaka Castle District',
    productName: 'osaka-castle-district',
    priceUsd: 29,
    priorityOrder: 4,
    inputGmlPattern: 'castle_*.gml',
  },
] as const;

export const OSAKA_MEGA_PACK: OsakaMegaPack = {
  displayName: 'Osaka Mega Pack',
  productName: 'osaka-mega-pack',
  priceUsd: 99,
  areas: ['dotonbori', 'namba', 'umeda', 'castle'],
};

export function getOsakaArea(name: OsakaAreaName): OsakaArea {
  const area = OSAKA_AREAS.find((a) => a.name === name);
  if (!area) throw new Error(`Unknown Osaka area: ${name}`);
  return area;
}
