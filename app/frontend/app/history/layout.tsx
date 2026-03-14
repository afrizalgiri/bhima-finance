import Providers from '../../components/Providers';
import Layout from '../../components/Layout';
export default function HistoryLayout({ children }: { children: React.ReactNode }) {
  return <Providers><Layout>{children}</Layout></Providers>;
}
