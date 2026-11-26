CREATE DATABASE IF NOT EXISTS inventory_db CHARACTER SET utf8mb4;
USE inventory_db;

CREATE TABLE IF NOT EXISTS items (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    quantity INT NOT NULL,
    item_condition VARCHAR(20) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT items_quantity_nonnegative CHECK (quantity >= 0),
    CONSTRAINT items_condition_valid CHECK (
        CAST(item_condition AS BINARY) IN ('good', 'damaged', 'maintenance')
    )
) ENGINE = InnoDB;
