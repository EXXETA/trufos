import '@/styles/tailwind.css';
import '@/styles/global.css';
import { Sidebar } from '@/view/Sidebar';
import { MainWindow } from '@/view/MainWindow';
import { Toaster } from '@/components/ui/toaster';
// import { Header } from '@/components/Header';

export const App = () => {
  return (
    <div className="size-full flex">
      <div className="flex flex-1">
        {/*<Header />*/}

        <div className="flex flex-1">
          <Sidebar />
          <MainWindow />
        </div>
      </div>
      <Toaster />
    </div>
  );
};
