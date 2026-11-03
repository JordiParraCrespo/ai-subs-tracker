import accounts from './es/accounts.json';
import auth from './es/auth.json';
import common from './es/common.json';
import consent from './es/consent.json';
import control from './es/control.json';
import emails from './es/emails.json';
import errors from './es/errors.json';
import extension from './es/extension.json';
import home from './es/home.json';
import language from './es/language.json';
import nav from './es/nav.json';
import onboarding from './es/onboarding.json';
import pages from './es/pages.json';
import publicCopy from './es/public.json';
import settings from './es/settings.json';
import table from './es/table.json';
import theme from './es/theme.json';
import toasts from './es/toasts.json';
import validation from './es/validation.json';

const es = {
  common,
  validation,
  errors,
  auth,
  accounts,
  home,
  nav,
  control,
  extension,
  language,
  consent,
  onboarding,
  pages,
  public: publicCopy,
  settings,
  table,
  theme,
  toasts,
  emails,
} as const;

export default es;
