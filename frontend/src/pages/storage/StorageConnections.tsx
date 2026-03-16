import usePageTitle from "../../hooks/usePageTitle";

const StorageConnections = () => {
  usePageTitle("Storage Connections — VerdantIQ");
  return (
    <div className="px-6 py-8">
      <div className="mb-8">
        <h1 className="text-lg font-semibold text-gray-800">Storage Connections</h1>
        <p className="text-sm text-gray-400 mt-0.5">Configure storage backend connections</p>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 flex flex-col items-center justify-center">
        <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7C5 4 4 5 4 7z M4 11h16" />
          </svg>
        </div>
        <p className="text-sm font-medium text-gray-500 mb-1">Storage Connections</p>
        <p className="text-xs text-gray-300">MinIO / S3 connection setup coming soon</p>
      </div>
    </div>
  );
};

export default StorageConnections;
