export { default } from "next-auth/middleware";

export const config = {
  matcher: ["/dashboard/:path*", "/api/folders/:path*", "/api/upload/:path*", "/api/files/:path*"],
};
