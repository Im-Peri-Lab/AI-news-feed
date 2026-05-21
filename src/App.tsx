import { useEffect, useState } from 'react';
import Header from './components/Header';
import NewsFeed from './components/NewsFeed';
import TagManager from './components/TagManager';
import { TagsProvider } from './contexts/TagsContext';

export default function App() {
  const [showTagManager, setShowTagManager] = useState(false);

  useEffect(() => {
    // Handle Kakao Share redirects
    const params = new URLSearchParams(window.location.search);
    const redirectUrl = params.get('redirect');
    if (redirectUrl) {
      window.location.href = redirectUrl;
      return;
    }

    const kakaoKey = '0dbe9648057ad88c3d6de74a0451de72'; // User provided JavaScript Key
    if (window.Kakao) {
      if (!window.Kakao.isInitialized()) {
        try {
          window.Kakao.init(kakaoKey);
          console.log('Kakao SDK Initialized:', window.Kakao.isInitialized());
          console.log('Detected Origin for Kakao:', window.location.origin);
        } catch (e) {
          console.error('Kakao Init Error:', e);
        }
      }
    }
  }, []);

  return (
    <TagsProvider>
      <div className="transition-colors duration-300">
        <div className="max-w-6xl mx-auto px-4 md:px-10 py-8 md:py-16 pb-16 md:pb-24">
          <Header onOpenSettings={() => setShowTagManager(true)} />
          <NewsFeed />
        </div>
      </div>
      {showTagManager && <TagManager onClose={() => setShowTagManager(false)} />}
    </TagsProvider>
  );
}
