export function AvatarStack({ count }: { count: number }) {
  return (
    <div className="flex -space-x-2">
      {Array.from({ length: count }, (_, index) => 12 + index).map((imgId) => (
        <img
          key={imgId}
          src={`https://i.pravatar.cc/48?img=${imgId}`}
          alt="Member avatar"
          className="h-5 w-5 rounded-full border-2 border-white object-cover"
        />
      ))}
    </div>
  );
}
