export default function Footer() {
  return (
    <>
      {/* White border line - separate element to ensure visibility against white background */}
      <div className="w-full bg-white" style={{ height: '4px', boxShadow: '0 -2px 4px rgba(0,0,0,0.1)' }}></div>
      <footer 
        className="w-full bg-gray-800 backdrop-blur-lg shadow-2xl mt-auto" 
        style={{ minHeight: 96 }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-24 py-2">
            <p className="text-gray-300 text-sm">© {new Date().getFullYear()} PronoFootball.Club - Tous droits réservés</p>
            <p className="text-gray-400 text-sm">Créé par Yann R.</p>
          </div>
        </div>
      </footer>
    </>
  );
}

