// Module declarations for packages that ship their own types but need help
// being resolved before the .next/ directory is generated.

declare module 'lucide-react' {
  import { FC, SVGProps } from 'react'
  type IconProps = SVGProps<SVGSVGElement> & { size?: number | string; strokeWidth?: number | string }
  type Icon = FC<IconProps>
  export const Play: Icon; export const Square: Icon; export const Trash2: Icon
  export const ChevronDown: Icon; export const ChevronUp: Icon
  export const Plus: Icon; export const Code2: Icon; export const FileText: Icon
  export const Bot: Icon; export const Table: Icon; export const Atom: Icon
  export const Pencil: Icon; export const Eye: Icon; export const Send: Icon
  export const PlusCircle: Icon; export const Upload: Icon
  export const Save: Icon; export const ChevronLeft: Icon
  export const Cpu: Icon; export const Cloud: Icon
  export const FlaskConical: Icon; export const BarChart2: Icon
  export const BookOpen: Icon; export const Beaker: Icon
}

declare module 'next/dynamic' {
  import { ComponentType, ReactNode } from 'react'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function dynamic<P = Record<string, any>>(
    loader: () => Promise<{ default: ComponentType<P> } | ComponentType<P>>,
    options?: { ssr?: boolean; loading?: () => ReactNode }
  ): ComponentType<P>
  export default dynamic
}
