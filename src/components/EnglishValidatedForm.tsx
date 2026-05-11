import type { FormHTMLAttributes, ReactNode } from "react";

type EnglishValidatedFormProps = FormHTMLAttributes<HTMLFormElement> & {
  children: ReactNode;
};

export function EnglishValidatedForm({
  children,
  noValidate: _ignoredNoValidate,
  ...formProps
}: EnglishValidatedFormProps) {
  return (
    <form {...formProps} noValidate>
      {children}
    </form>
  );
}
