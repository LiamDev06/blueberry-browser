// Lets us import an .html file as a string via Vite's `?raw` suffix
declare module "*.html?raw" {
  const content: string;
  export default content;
}
