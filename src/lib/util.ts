export function extractStudentId(text: string): string | null {
  const m = text.match(/\d{11}/);
  return m ? m[0] : null;
}
