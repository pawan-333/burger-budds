import {GlobalHeader} from '@/components/layout/GlobalHeader';
import {GlobalFooter} from '@/components/layout/GlobalFooter';
import {StoreFinder} from '@/components/stores/StoreFinder';
import {HOME_TITLE,HOME_DESCRIPTION,pageMetadata} from '@/lib/seo';
export const metadata=pageMetadata(HOME_TITLE,HOME_DESCRIPTION,'/');
export default function HomePage(){return <><GlobalHeader/><main className="px-4 py-12"><StoreFinder/></main><GlobalFooter/></>;}
