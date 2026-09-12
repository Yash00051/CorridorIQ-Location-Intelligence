declare module 'react-csv' {
  import type { AnchorHTMLAttributes, ComponentType, ReactNode } from 'react';

  export interface CSVLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
    data: unknown[];
    filename?: string;
    children?: ReactNode;
  }

  export const CSVLink: ComponentType<CSVLinkProps>;
}