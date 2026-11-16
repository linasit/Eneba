# Homepage content ownership

The homepage calls `/api/home/layout`. Each enabled `home_blocks` row supplies its type, order, title and config (endpoint, localized title and tooltip, show-all URL and rendering kind). Disabling or reordering a row changes the next layout response. The frontend has renderers for supported block types; it does not insert missing blocks or seed editorial data.

Each block fetches its own endpoint. The existing Go home module serves these endpoints from PostgreSQL:

| Content | Endpoint | Database source |
|---|---|---|
| Promotions | `/home/banners` | `banners`, including schedule and active flag |
| Category shortcuts | `/home/categories` | `home_categories` |
| Recently viewed | `/home/recently-viewed?slugs=…` | Catalog and available offers; browser supplies viewed identifiers only |
| Recommendations | `/home/recommended` | `home_product_groups` ordering plus catalog/available offers |
| Best sellers | `/home/best-sellers` | Catalog sales counts and available offers |
| eGift brands | `/home/gift-brands` | `home_gift_brands`, including image and destination |
| Gift-card products | `/home/gift-cards` | Product groups and available catalog offers |
| Pre-orders | `/home/upcoming` | Pre-order catalog category and available offers |
| Genres | `/home/genres` | `home_genres` and live inventory counts |

Endpoints share the application's PostgreSQL database; they are not separate deployed microservices. Responses have 60-second shared-cache TTL and up to 300 seconds stale-while-revalidate. Content edits may therefore take time to appear on cached deployments. Changes are made via migrations or database administration; no CMS editing UI is included.

General interface strings (loading/error messages, button labels), translation dictionaries, icons, renderer types and visual styling remain frontend presentation code. Product prices, inventory availability, collections, branding lists and section configuration come from the backend. No substitute product list is rendered after an API failure.

## Cheap-games promotion

`/store?sort=discount` and `/promo/cheap-games` render the promotion. Adding filters opens the regular catalog. `/api/promotions/cheap-games` reads hero copy, artwork and section configuration from `promotion_pages` and `promotion_sections`; each configured section endpoint reads its ordered `home_product_groups` collection and the cheapest available catalog offers. Migration `011_cheap_games.sql` seeds the reference products with demo inventory only. Carousel actions use the existing wishlist, cart and product-detail flows.

The cheap-games review strip reads its link, review-count snapshot, rating and brand from `promotion_pages.config.trustpilot`. Migration 012 expands the Xbox and game-points groups to ten products each; all offers continue to use simulated payments and TEST inventory.
