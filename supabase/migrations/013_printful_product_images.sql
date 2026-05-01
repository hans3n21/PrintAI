alter table if exists printful_products
  add column if not exists product_images jsonb not null default '[]'::jsonb;

comment on column printful_products.product_images is
  'Printful blank/product images for editor preview: {catalog_variant_id, color, color_hex, placement, image_url, background_color, background_image, mockup_style_id}.';
