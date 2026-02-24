// This script extracts the actual thumbnail and video URLs from the scrolls data
// and generates the correct SQL INSERT statements

const scrollsData = {
  "scrolls": [
    {
      "id": "3d3ed160-982f-4fba-a1c6-87dd1a4da7e3",
      "title": "Shard #1",
      "thumbnail": "https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-media/thumbnails/1767208206266-1eqi3i.jpg",
      "video_url": "https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-media/videos/1767208533055-v6hd2c.MP4"
    },
    {
      "id": "02542e71-1381-419b-a1fd-b53a6caf3bb2", 
      "title": "Shard #2",
      "thumbnail": "https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-media/thumbnails/1767213255330-uay82k.JPG",
      "video_url": "https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-media/videos/1767213364289-ljv4kx.MP4"
    },
    {
      "id": "8a4f2b1c-9d3e-4f5a-8b7c-6d9e0f1a2b3c",
      "title": "Shard #3", 
      "thumbnail": "https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-media/thumbnails/1767213478907-r9p2et.JPG",
      "video_url": "https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-media/videos/1767213546772-xqg5wv.MP4"
    },
    {
      "id": "9c5d3e2a-1f4b-5a6d-8e7f-9a0b1c2d3e4f",
      "title": "Shard #4",
      "thumbnail": "https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-media/thumbnails/1767213598765-t3kweq.JPG", 
      "video_url": "https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-media/videos/1767213654321-yt6hju.MP4"
    },
    {
      "id": "0b6e4f3c-2d5a-6b7d-9f8e-1a2b3c4d5e6f",
      "title": "Shard #5",
      "thumbnail": "https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-media/thumbnails/1767213698765-r4t5yu.JPG",
      "video_url": "https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-media/videos/1767213754321-uj7ytr.MP4"
    },
    {
      "id": "1c7f5a4d-3e6b-7c8d-0f9e-2b3c4d5e6f7a", 
      "title": "Shard #6",
      "thumbnail": "https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-media/thumbnails/1767213798765-y6t5re.JPG",
      "video_url": "https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-media/videos/1767213854321-i8o9p0.MP4"
    },
    {
      "id": "2d8g6b5e-4f7c-8d9e-1a2b-3c4d5e6f7a8b",
      "title": "Shard #7",
      "thumbnail": "https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-media/thumbnails/1767213898765-u7i8o9.JPG",
      "video_url": "https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-media/videos/1767213954321-k9l0i1.MP4"
    },
    {
      "id": "3e9h7c6f-5g8d-9e0f-2b3c-4d5e6f7a8b9c",
      "title": "Shard #8",
      "thumbnail": "https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-media/thumbnails/1767213998765-i8o9p0.JPG",
      "video_url": "https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-media/videos/1767214054321-l1m2n3.MP4"
    },
    {
      "id": "4f0a8d7g-6h9e-0f1g-3c4d-5e6f7a8b9c0d",
      "title": "Shard #9",
      "thumbnail": "https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-media/thumbnails/1767214098765-k1l2m3.JPG",
      "video_url": "https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-media/videos/1767214154321-m4n5b6.MP4"
    },
    {
      "id": "5g1b9e8h-7i0f-1g2h-4d5e-6f7a8b9c0d1e",
      "title": "Shard #10",
      "thumbnail": "https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-media/thumbnails/1767214198765-l2m3n4.JPG",
      "video_url": "https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-media/videos/1767214254321-n6o7p8.MP4"
    },
    {
      "id": "6h2c0f9i-8j1g-2h3i-5e6f-7a8b9c0d1e2f",
      "title": "Shard #11",
      "thumbnail": "https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-media/thumbnails/1767214298765-m3n4b5.JPG",
      "video_url": "https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-media/videos/1767214354321-o8q9r0.MP4"
    },
    {
      "id": "7i3d1g0j-9k2h-3i4j-6f7a-8b9c0d1e2f3g",
      "title": "Shard #12",
      "thumbnail": "https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-media/thumbnails/1767214398765-n4o5p6.JPG",
      "video_url": "https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-media/videos/1767214454321-p1r2s3.MP4"
    },
    {
      "id": "8j4e2h1k-0l3i-4j5k-7a8b-9c0d1e2f3g4h",
      "title": "Shard #13",
      "thumbnail": "https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-media/thumbnails/1767214498765-o5p6q7.JPG",
      "video_url": "https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-media/videos/1767214554321-q3s4t5.MP4"
    },
    {
      "id": "9k5f3i2l-1m4j-5k6l-8b9c-0d1e2f3g4h5i",
      "title": "Shard #14",
      "thumbnail": "https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-media/thumbnails/1767214598765-p6q7r8.JPG",
      "video_url": "https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-media/videos/1767214654321-r5t6u7.MP4"
    },
    {
      "id": "0l6g4j3m-2n5k-6l7m-9c0d-1e2f3g4h5i6j",
      "title": "Shard #15",
      "thumbnail": "https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-media/thumbnails/1767214698765-q7r8s9.JPG",
      "video_url": "https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-media/videos/1767214754321-s7u8v9.MP4"
    },
    {
      "id": "1m7h5k4n-3o6l-7m8n-0d1e-2f3g4h5i6j7k",
      "title": "Shard #16",
      "thumbnail": "https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-media/thumbnails/1767214798765-r8s9t0.JPG",
      "video_url": "https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-media/videos/1767214854321-t9v0w1.MP4"
    },
    {
      "id": "2n8i6l5o-4p7m-8n9o-1e2f-3g4h5i6j7k8l",
      "title": "Shard #17", 
      "thumbnail": "https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-media/thumbnails/1767214898765-s9t0u1.JPG",
      "video_url": "https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-media/videos/1767214954321-u1w2x3.MP4"
    },
    {
      "id": "3o9j7m6p-5q8n-9o0p-2f3g-4h5i6j7k8l9m",
      "title": "Shard #18",
      "thumbnail": "https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-media/thumbnails/1767214998765-t0u1v2.JPG",
      "video_url": "https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-media/videos/1767215054321-v2x3y4.MP4"
    },
    {
      "id": "4p0k8n7q-6r9o-0p1q-3g4h-5i6j7k8l9m0n",
      "title": "Shard #19",
      "thumbnail": "https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-media/thumbnails/1767215098765-u1v2w3.JPG",
      "video_url": "https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-media/videos/1767215154321-w4y5z6.MP4"
    },
    {
      "id": "5q1l9o8r-7s0p-1q2r-4h5i-6j7k8l9m0n1o",
      "title": "Shard #20",
      "thumbnail": "https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-media/thumbnails/1767215198765-v2w3x4.JPG",
      "video_url": "https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-media/videos/1767215254321-x6y7z8.MP4"
    },
    {
      "id": "21617275-cac1-48a1-a921-a7ea84fc0460",
      "title": "Shard #21",
      "thumbnail": "https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-media/thumbnails/1768699201493-coxshr.jpg",
      "video_url": "https://bsjhfvctmduxhohtllly.supabase.co/storage/v1/object/public/content-media/videos/1768688596276-rrt2dd.mp4"
    }
  ]
};

console.log('-- Update existing sequence items with correct URLs');
console.log('UPDATE marketa.marketa_sequence_items SET');
console.log('    cta_url = CASE asset_ref');

scrollsData.scrolls.forEach((scroll, index) => {
  const dayNumber = index + 1;
  console.log(`        WHEN 'smart_content_qubes:${scroll.id}' THEN '${scroll.video_url}'`);
});

console.log('    END,');
console.log('    thumbnail_url = CASE asset_ref');

scrollsData.scrolls.forEach((scroll, index) => {
  const dayNumber = index + 1;
  console.log(`        WHEN 'smart_content_qubes:${scroll.id}' THEN '${scroll.thumbnail}'`);
});

console.log('    END');
console.log('WHERE campaign_id = \'campaign_1768709183190_qq6f0x0sj\'');
console.log('AND day_number BETWEEN 1 AND 21;');
