"use client";

import NextLink from "next/link";
import { useParams as useNextParams, usePathname, useRouter } from "next/navigation";

export function Link({ to, href, children, ...props }) {
  return <NextLink href={href || to} {...props}>{children}</NextLink>;
}

export function NavLink({ to, end = false, className, children, ...props }) {
  const pathname = usePathname();
  const isActive = end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);
  const resolvedClassName = typeof className === "function" ? className({ isActive }) : className;
  // React Router marks the active link with aria-current="page"; keep that parity.
  return <NextLink href={to} className={resolvedClassName} aria-current={isActive ? "page" : undefined} {...props}>{children}</NextLink>;
}

export function useLocation() {
  return { pathname: usePathname() };
}

export function useNavigate() {
  const router = useRouter();
  return (to) => typeof to === "number" ? router.back() : router.push(to);
}

export function useParams() {
  const params = useNextParams();
  return { ...params, id: params.id || params.slug };
}
