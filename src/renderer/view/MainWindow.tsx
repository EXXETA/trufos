// import { Header } from '@/components/Header';
import { MainTopBar } from '@/components/mainWindow/MainTopBar';
import { MainBody } from '@/components/mainWindow/MainBody';

export function MainWindow() {
  return (
    <div className={'flex flex-col flex-auto p-6'}>
      {/*<Header />*/}
      <MainTopBar />
      <MainBody />
    </div>
  );
}
