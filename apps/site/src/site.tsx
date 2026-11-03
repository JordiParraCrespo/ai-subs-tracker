import { CallToAction } from './sections/call-to-action';
import { Features } from './sections/features';
import { Hero } from './sections/hero';
import { HowItWorks } from './sections/how-it-works';
import { Privacy } from './sections/privacy';
import { ProductPreview } from './sections/product-preview';
import { SiteFooter } from './sections/site-footer';
import { SiteHeader } from './sections/site-header';

/** The whole page, in the order `designs/Marketing Page.dc.html` lays it out. */
export function Site() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <ProductPreview />
        <Features />
        <HowItWorks />
        <Privacy />
        <CallToAction />
      </main>
      <SiteFooter />
    </>
  );
}
