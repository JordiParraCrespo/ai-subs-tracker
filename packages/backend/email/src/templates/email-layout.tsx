import {
  Body,
  Column,
  Container,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from '@react-email/components';
import type * as React from 'react';

interface EmailLayoutProps {
  locale: string;
  preview: string;
  brandName: string;
  footer: string;
  heroLabel?: string;
  children: React.ReactNode;
}

export function EmailLayout({
  locale,
  preview,
  brandName,
  footer,
  heroLabel,
  children,
}: EmailLayoutProps) {
  return (
    <Html lang={locale}>
      <Head>
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
        <style>{responsiveStyles}</style>
      </Head>
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container className="email-wrap" style={wrapper}>
          <Section style={brandSection}>
            <Row>
              <Column style={brandMarkCell}>
                <Img src={OWL_MARK_URL} width="28" height="28" alt="" style={brandMark} />
              </Column>
              <Column>
                <Text style={brand}>{brandName}</Text>
              </Column>
            </Row>
          </Section>

          <Section style={card}>
            {heroLabel ? (
              <Section style={hero}>
                <Text style={heroText}>{heroLabel}</Text>
              </Section>
            ) : (
              <Section style={accent}>
                <Text style={accentSpacer}>&nbsp;</Text>
              </Section>
            )}
            {children}
          </Section>

          <Section className="email-px" style={footerSection}>
            <Text style={footerText}>{footer}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export function Divider() {
  return (
    <Section style={dividerSection}>
      <Text style={divider}>&nbsp;</Text>
    </Section>
  );
}

export function FallbackLink({ label, url }: { label: string; url: string }) {
  return (
    <Text style={fallbackText}>
      {label}
      <br />
      <Link href={url} style={link}>
        {url}
      </Link>
    </Text>
  );
}

const responsiveStyles = `
  @media only screen and (max-width: 620px) {
    .email-wrap { width: 100% !important; }
    .email-px { padding-left: 24px !important; padding-right: 24px !important; }
    .email-heading { font-size: 22px !important; line-height: 29px !important; }
    .email-button { display: block !important; text-align: center !important; }
  }
`;

/**
 * ResetOwl's palette for mail, from the design system's tokens
 * (`packages/frontend/design-system/web/src/styles/resetowl-ds.css`): the
 * brand purple and its lavender scale on the light ink. Literal values, since
 * mail clients resolve no CSS variables, and light only: a mail client keeps
 * HTML mail on its own light surface.
 */
export const palette = {
  brand: '#7764D8', // --ds-brand / --ds-purple-500
  brandDeep: '#5F4CC2', // --ds-purple-600
  brandInk: '#4D3BA3', // --ds-purple-700
  lavender: '#B9B0F0', // --ds-purple-300
  lavenderSoft: '#E6E2F8', // --ds-purple-100
  lavenderWash: '#F3F1FC', // --ds-purple-50
  page: '#F7F6FC',
  card: '#FFFFFF',
  ink: '#171717', // --ds-text (light)
  inkSecondary: '#525252', // --ds-text-secondary (light)
  inkMuted: '#737373', // --ds-text-muted (light)
  rule: '#E6E2F8',
} as const;

/**
 * The owl mark (`apps/web/public/favicon.svg` as a PNG), served by the site:
 * Gmail and Outlook show neither SVG nor inline images, so the mark is a
 * hosted file. Decorative — the brand name sits beside it.
 */
export const OWL_MARK_URL = 'https://resetowl.com/email/owl-mark.png';

export const fontFamily =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif';

const main: React.CSSProperties = {
  margin: 0,
  padding: '40px 16px',
  backgroundColor: palette.page,
  color: palette.ink,
  fontFamily,
};

const wrapper: React.CSSProperties = {
  width: '600px',
  maxWidth: '600px',
  margin: '0 auto',
};

const brandSection: React.CSSProperties = { padding: '0 8px 20px' };

const brandMarkCell: React.CSSProperties = { width: '38px', verticalAlign: 'middle' };

const brandMark: React.CSSProperties = {
  display: 'block',
  width: '28px',
  height: '28px',
  border: 0,
  borderRadius: '7px',
};

const brand: React.CSSProperties = {
  margin: 0,
  color: palette.ink,
  fontFamily,
  fontSize: '16px',
  fontWeight: 600,
  letterSpacing: '-0.3px',
  lineHeight: '28px',
};

const card: React.CSSProperties = {
  overflow: 'hidden',
  backgroundColor: palette.card,
  border: `1px solid ${palette.rule}`,
  borderRadius: '16px',
};

const accent: React.CSSProperties = {
  height: '6px',
  backgroundColor: palette.brand,
  backgroundImage: `linear-gradient(90deg,${palette.lavender} 0%,${palette.brand} 50%,${palette.brandInk} 100%)`,
};

const accentSpacer: React.CSSProperties = {
  height: '6px',
  margin: 0,
  fontSize: '6px',
  lineHeight: '6px',
};

const hero: React.CSSProperties = {
  height: '112px',
  backgroundColor: palette.brand,
  backgroundImage: `linear-gradient(135deg,${palette.lavender} 0%,${palette.brand} 55%,${palette.brandInk} 100%)`,
  textAlign: 'center',
  verticalAlign: 'middle',
};

const heroText: React.CSSProperties = {
  margin: 0,
  padding: '47px 16px',
  color: '#FFFFFF',
  fontFamily,
  fontSize: '13px',
  fontWeight: 500,
  letterSpacing: '-0.15px',
  lineHeight: '18px',
};

const footerSection: React.CSSProperties = { padding: '22px 8px 0' };

const footerText: React.CSSProperties = {
  margin: 0,
  color: palette.inkMuted,
  fontFamily,
  fontSize: '12px',
  letterSpacing: '-0.15px',
  lineHeight: '19px',
  whiteSpace: 'pre-line',
};

const dividerSection: React.CSSProperties = { padding: '24px 40px 0' };

const divider: React.CSSProperties = {
  height: '1px',
  margin: 0,
  backgroundColor: palette.rule,
  fontSize: '1px',
  lineHeight: '1px',
};

const fallbackText: React.CSSProperties = {
  margin: 0,
  color: palette.inkMuted,
  fontFamily,
  fontSize: '12px',
  letterSpacing: '-0.15px',
  lineHeight: '19px',
};

export const link: React.CSSProperties = {
  color: palette.brandDeep,
  textDecoration: 'none',
  wordBreak: 'break-all',
};

export const heading: React.CSSProperties = {
  margin: '0 0 10px',
  color: palette.ink,
  fontFamily,
  fontSize: '24px',
  fontWeight: 500,
  letterSpacing: '-0.3px',
  lineHeight: '31px',
};

export const bodyText: React.CSSProperties = {
  margin: 0,
  color: palette.inkSecondary,
  fontFamily,
  fontSize: '14px',
  letterSpacing: '-0.15px',
  lineHeight: '22px',
};

export const mutedText: React.CSSProperties = {
  margin: 0,
  color: palette.inkMuted,
  fontFamily,
  fontSize: '13px',
  letterSpacing: '-0.15px',
  lineHeight: '20px',
};

export const primaryButton: React.CSSProperties = {
  display: 'inline-block',
  padding: '13px 30px',
  backgroundColor: palette.brand,
  borderRadius: '999px',
  color: '#FFFFFF',
  fontFamily,
  fontSize: '14px',
  fontWeight: 600,
  letterSpacing: '-0.15px',
  lineHeight: '18px',
  textAlign: 'center',
  textDecoration: 'none',
};
