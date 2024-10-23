import '@/styles/tailwind.css';
import '@/styles/global.css';
import { Sidebar } from '@/view/Sidebar';
import { MainWindow } from '@/view/MainWindow';
import { Toaster } from '@/components/ui/toaster';
// import { Header } from '@/components/Header';

export const App = () => {
  return (
    <div>
      <div className="size-full">
        {/*<Header />*/}

        <div className="h-screen flex items-stretch">
          <Sidebar />
          <MainWindow />
        </div>
      </div>
      <Toaster />
    </div>
  );
};
