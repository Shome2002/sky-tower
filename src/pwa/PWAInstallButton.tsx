import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from './usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="flex items-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-500 active:scale-95 px-4 py-2.5 text-sm font-bold text-white shadow-md transition-all cursor-pointer whitespace-nowrap shrink-0"
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>태블릿 홈 화면에 앱 설치</span>
      </button>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 pointer-events-auto">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 text-slate-900 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center">
                  <Smartphone className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-extrabold text-slate-900">
                  태블릿 앱으로 설치하는 방법
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
                aria-label="닫기"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm text-slate-700 leading-relaxed">
              {isIOS ? (
                <>
                  <p className="font-semibold text-slate-900">iPad / iPhone (Safari 브라우저)</p>
                  <ol className="list-decimal list-inside space-y-1.5 text-slate-600">
                    <li>상단 또는 하단 주소창의 <strong>공유(Share)</strong> 아이콘을 터치하세요.</li>
                    <li>메뉴에서 <strong>홈 화면에 추가</strong>를 선택하면 앱처럼 전체 화면으로 실행됩니다.</li>
                  </ol>
                </>
              ) : (
                <>
                  <p className="font-semibold text-slate-900">안드로이드 태블릿 (Chrome 브라우저)</p>
                  <ol className="list-decimal list-inside space-y-1.5 text-slate-600">
                    <li>AI Studio 우측 상단의 <strong>새 탭에서 열기(공유 URL)</strong>로 게임을 엽니다.</li>
                    <li>크롬 우측 상단 메뉴(⋮) 또는 주소창의 <strong>앱 설치 / 홈 화면에 추가</strong>를 터치하세요.</li>
                    <li>바탕화면에 생성된 <strong>스카이타워</strong> 아이콘을 누르면 주소창 없는 전체 화면 게임 앱으로 작동합니다!</li>
                  </ol>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-6 w-full h-12 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm cursor-pointer transition-colors"
            >
              확인했어요
            </button>
          </div>
        </div>
      )}
    </>
  );
};
