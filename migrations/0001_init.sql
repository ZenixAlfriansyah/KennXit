CREATE TABLE admins(id INTEGER PRIMARY KEY AUTOINCREMENT,email TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL);
CREATE TABLE login_attempts(ip TEXT NOT NULL,ts INTEGER NOT NULL);
CREATE TABLE game_categories(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,slug TEXT UNIQUE NOT NULL,icon_url TEXT,status INTEGER NOT NULL DEFAULT 1);
CREATE TABLE products(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,slug TEXT UNIQUE NOT NULL,game_category_id INTEGER REFERENCES game_categories(id),image_url TEXT,description TEXT,total_sold INTEGER NOT NULL DEFAULT 0,status INTEGER NOT NULL DEFAULT 1,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE product_variants(id INTEGER PRIMARY KEY AUTOINCREMENT,product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,name TEXT,duration TEXT NOT NULL,price INTEGER NOT NULL,status INTEGER NOT NULL DEFAULT 1,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE banners(id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,description TEXT,image_url TEXT,target_url TEXT,display_order INTEGER NOT NULL DEFAULT 0,status INTEGER NOT NULL DEFAULT 1,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE website_settings(id INTEGER PRIMARY KEY AUTOINCREMENT,setting_key TEXT UNIQUE NOT NULL,setting_value TEXT,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX idx_p_status ON products(status,id);
CREATE INDEX idx_v_p ON product_variants(product_id);
INSERT INTO game_categories(name,slug) VALUES('Free Fire','free-fire'),('Mobile Legends','mobile-legends'),('PUBG Mobile','pubg-mobile'),('Roblox','roblox'),('Game Lainnya','game-lainnya');
INSERT INTO website_settings(setting_key,setting_value) VALUES
('site_name','KENXIT STORE'),('store_name','KENXIT STORE'),('site_description','Katalog produk digital game. Pilih varian, pesan lewat WhatsApp.'),
('whatsapp_number','6285701863281'),('footer_text','© KENXIT STORE'),('instagram',''),('tiktok',''),('contact_info',''),('logo_url',''),('favicon_url',''),
('wa_template','✦ *ORDER REQUEST — KENXIT*

Saya ingin melakukan pemesanan produk dengan detail berikut:

*PRODUCT* : {product}

*GAME* : {game}

*DURATION* : {duration}

*TOTAL PRICE* : Rp{price}

Mohon konfirmasi ketersediaan produk dan proses pemesanan.

— *KENXIT STORE*');
