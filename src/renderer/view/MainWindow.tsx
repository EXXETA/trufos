// import { Header } from '@/components/Header';
import { MainTopBar } from '@/components/mainWindow/MainTopBar';
import { MainBody } from '@/components/mainWindow/MainBody';
import { selectRequest, useRequestStore } from '@/state/requestStore';

export function MainWindow() {
  const requestSelected = useRequestStore((state) => selectRequest(state) != null);
  if (!requestSelected) {
    return null;
  }

  return (
    <div className={'flex flex-col flex-auto p-6'}>
      {/*<Header />*/}
      <MainTopBar />
      <MainBody />
    </div>
  );
}
