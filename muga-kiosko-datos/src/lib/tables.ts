export type LibrePlan =
  | "Libre 1" | "Libre 2" | "Libre 3" | "Libre 4" | "Libre 5"
  | "Libre 6" | "Libre 7" | "Libre 9" | "Libre 12" | "Libre VIP";

export const RENTA_POR_PLAN: Record<LibrePlan, number> = {
  "Libre 1": 249,
  "Libre 2": 319,
  "Libre 3": 399,
  "Libre 4": 499,
  "Libre 5": 599,
  "Libre 6": 699,
  "Libre 7": 799,
  "Libre 9": 999,
  "Libre 12": 1299,
  "Libre VIP": 1499,
};

export const GB_POR_PLAN: Record<LibrePlan, number> = {
  "Libre 1": 4,
  "Libre 2": 5,
  "Libre 3": 6,
  "Libre 4": 10,
  "Libre 5": 20,
  "Libre 6": 30,
  "Libre 7": 40,
  "Libre 9": 45,
  "Libre 12": 55,
  "Libre VIP": 40,
};

export function planSiguiente(plan: LibrePlan): LibrePlan | null {
  const orden: LibrePlan[] = ["Libre 1","Libre 2","Libre 3","Libre 4","Libre 5","Libre 6","Libre 7","Libre 9","Libre 12","Libre VIP"];
  const i = orden.indexOf(plan);
  if (i === -1 || i === orden.length - 1) return null;
  return orden[i+1];
}
