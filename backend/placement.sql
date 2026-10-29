-- Adminer 6.1.1 MySQL 8.0.44 dump

SET NAMES utf8;
SET time_zone = '+00:00';
SET foreign_key_checks = 0;
SET sql_mode = 'NO_AUTO_VALUE_ON_ZERO';

SET NAMES utf8mb4;

DROP TABLE IF EXISTS `placement_drive`;
CREATE TABLE `placement_drive` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `company_id` bigint NOT NULL,
  `job_role` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `placement_type` enum('Full-time Placment','Internship + PPO','Internship','Apprenticeship') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `package_lpa` decimal(8,2) DEFAULT NULL,
  `drive_start_date` date DEFAULT NULL,
  `drive_end_date` date DEFAULT NULL,
  `drive_owner_user_id` bigint unsigned DEFAULT NULL,
  `job_description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `overall_status` enum('draft','registration_open','scheduled','in_progress','awaiting_next_round','awaiting_final_result','completed','on_hold','cancelled') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'draft',
  `result_publication_date` date DEFAULT NULL,
  `result_reference` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `result_notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `batch_id` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_placement_drive_company` (`company_id`),
  KEY `idx_placement_drive_owner` (`drive_owner_user_id`),
  KEY `idx_placement_drive_batch_id` (`batch_id`),
  CONSTRAINT `fk_placement_drive_batch` FOREIGN KEY (`batch_id`) REFERENCES `batches` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_placement_drive_company` FOREIGN KEY (`company_id`) REFERENCES `placement_company` (`id`),
  CONSTRAINT `fk_placement_drive_owner` FOREIGN KEY (`drive_owner_user_id`) REFERENCES `master_users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `placement_drive` (`id`, `company_id`, `job_role`, `placement_type`, `package_lpa`, `drive_start_date`, `drive_end_date`, `drive_owner_user_id`, `job_description`, `overall_status`, `result_publication_date`, `result_reference`, `result_notes`, `created_at`, `updated_at`, `batch_id`) VALUES
(1,	1,	'Software Engineer',	'Full-time Placment',	8.50,	'2026-11-05',	'2026-11-10',	6,	'Software development and problem-solving role.',	'in_progress',	NULL,	NULL,	'Technical interviews are in progress.',	'2026-10-28 09:36:33',	'2026-10-29 08:49:00',	1),
(2,	2,	'Graduate Engineer Trainee',	'Internship + PPO',	5.00,	'2026-11-15',	'2026-11-18',	6,	'Entry-level engineering role.',	'scheduled',	NULL,	NULL,	'Drive scheduled for eligible students.',	'2026-10-28 09:36:33',	'2026-10-29 08:49:07',	1),
(3,	16,	'Software Interns',	'Internship + PPO',	7.50,	'2026-10-30',	'2026-10-31',	7,	'',	'draft',	NULL,	'',	'',	'2026-10-29 05:50:17',	'2026-10-29 08:49:13',	1),
(4,	16,	'Software Engineer',	'Apprenticeship',	12.00,	'2026-05-04',	NULL,	6,	'',	'registration_open',	NULL,	'',	'',	'2026-10-29 06:30:40',	'2026-10-29 08:50:41',	2)
ON DUPLICATE KEY UPDATE `id` = VALUES(`id`), `company_id` = VALUES(`company_id`), `job_role` = VALUES(`job_role`), `placement_type` = VALUES(`placement_type`), `package_lpa` = VALUES(`package_lpa`), `drive_start_date` = VALUES(`drive_start_date`), `drive_end_date` = VALUES(`drive_end_date`), `drive_owner_user_id` = VALUES(`drive_owner_user_id`), `job_description` = VALUES(`job_description`), `overall_status` = VALUES(`overall_status`), `result_publication_date` = VALUES(`result_publication_date`), `result_reference` = VALUES(`result_reference`), `result_notes` = VALUES(`result_notes`), `created_at` = VALUES(`created_at`), `updated_at` = VALUES(`updated_at`), `batch_id` = VALUES(`batch_id`);

-- 2026-10-29 08:52:04 UTC
