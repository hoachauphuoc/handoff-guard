// One place for "1 thing" / "2 things" so quotes and panel text never say "1 decisions".
export const count = (n: number, one: string, many = one + "s"): string => `${n} ${n === 1 ? one : many}`;
