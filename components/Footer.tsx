export default function Footer() {
  return (
    <>
      {/* White border line - separate element to ensure visibility against white background */}
      <div className="w-full bg-white dark:bg-gray-800" style={{ height: '4px', boxShadow: '0 -2px 4px rgba(0,0,0,0.1)' }}></div>
      <footer 
        className="w-full bg-gray-800 dark:bg-gray-900 backdrop-blur-lg shadow-2xl mt-auto border-t border-white dark:border-accent-dark-500" 
        style={{ minHeight: 96 }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-24 py-2">
            <p className="text-gray-300 dark:text-gray-400 text-xs sm:text-sm whitespace-nowrap">
              © {new Date().getFullYear()} PronoFootball.Club<span className="hidden sm:inline"> - Tous droits réservés</span>
            </p>
            <p className="text-gray-400 dark:text-gray-500 text-xs sm:text-sm">
              <span className="block sm:inline">Developed and Maintained</span>
              <span className="block sm:inline sm:ml-1">by Kuma Flynt</span>
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}

