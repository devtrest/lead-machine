export function Skeleton({
  className = "",
  rounded = "rounded-md",
}: {
  className?: string;
  rounded?: string;
}) {
  return <span className={`skeleton block ${rounded} ${className}`} />;
}
