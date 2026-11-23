// Line icons from the design system's assets/Icons: 24px grid, 1.8 stroke, round caps
// and joins, drawn in currentColor so they take their label's color.

type IconProps = { className?: string };

function Icon({ className = "ci-icon", children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const DrinksIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 4h14l-7 8z" />
    <path d="M12 12v8M8 20h8" />
  </Icon>
);

export const BarIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 2h4v4l2 3v12H8V9l2-3z" />
    <path d="M8 13h8" />
  </Icon>
);

export const BuyIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7h16l-1.5 13h-13z" />
    <path d="M9 7V5a3 3 0 0 1 6 0v2" />
  </Icon>
);

export const BooksIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 3h4v18H5zM10 3h4v18h-4z" />
    <path d="M15.5 4.5l3.8-1 3.2 17-3.8 1z" />
  </Icon>
);

export const SearchIcon = ({ className = "ci-icon-sm" }: IconProps) => (
  <Icon className={className}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </Icon>
);

export const CloseIcon = ({ className = "ci-icon-sm" }: IconProps) => (
  <Icon className={className}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
);

export const ChevronDownIcon = ({ className = "ci-icon-sm" }: IconProps) => (
  <Icon className={className}>
    <path d="M6 9l6 6 6-6" />
  </Icon>
);

export const ChevronLeftIcon = ({ className = "ci-icon-sm" }: IconProps) => (
  <Icon className={className}>
    <path d="M15 6l-6 6 6 6" />
  </Icon>
);

export const ChevronRightIcon = ({ className = "ci-icon-sm" }: IconProps) => (
  <Icon className={className}>
    <path d="M9 6l6 6-6 6" />
  </Icon>
);
