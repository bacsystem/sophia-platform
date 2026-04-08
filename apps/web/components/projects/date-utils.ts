/** @description Simple relative date formatter without external dependencies */
export function formatDistanceToNow(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);

  if (months >= 1) return `hace ${months} ${months === 1 ? 'mes' : 'meses'}`;
  if (days >= 1) return `hace ${days} ${days === 1 ? 'día' : 'días'}`;
  if (hours >= 1) return `hace ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
  if (minutes >= 1) return `hace ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;
  return 'ahora mismo';
}
