-- Adminer 6.1.1 MySQL 8.0.44 dump

SET NAMES utf8;
SET time_zone = '+00:00';
SET foreign_key_checks = 0;
SET sql_mode = 'NO_AUTO_VALUE_ON_ZERO';

SET NAMES utf8mb4;

DROP TABLE IF EXISTS `batches`;
CREATE TABLE `batches` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


DROP TABLE IF EXISTS `departments`;
CREATE TABLE `departments` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


DROP TABLE IF EXISTS `master_users`;
CREATE TABLE `master_users` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `roll_no` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `name` varchar(150) NOT NULL,
  `email` varchar(255) NOT NULL,
  `department_id` bigint unsigned DEFAULT NULL,
  `role_id` bigint unsigned NOT NULL,
  `batch_id` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `fk_users_department` (`department_id`),
  KEY `fk_users_role` (`role_id`),
  KEY `fk_users_batch` (`batch_id`),
  CONSTRAINT `fk_users_batch` FOREIGN KEY (`batch_id`) REFERENCES `batches` (`id`),
  CONSTRAINT `fk_users_department` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`),
  CONSTRAINT `fk_users_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


DROP TABLE IF EXISTS `placement_company`;
CREATE TABLE `placement_company` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `company_code` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `company_name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `collaboration_type` enum('ACTIVE','INACTIVE','NEW') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `contact_status` enum('CONTACTED','NOT_CONTACTED') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `category` enum('PRODUCT','SERVICE','CORE_FINANCE','NETWORKING','HEALTHCARE') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `recruiting_quarter` enum('Q1','Q2','Q3','Q4','NA') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `employee_size` enum('1-50','51-100','101-200','201-500','501-1000','1001-5000','5001-10000','>=10000') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `founded_year` year NOT NULL,
  `spoc1_name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `spoc1_email` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `spoc1_contact` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `spoc2_name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `spoc2_email` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `spoc2_contact` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `status` enum('0','1') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `placement_company_batch_placements`;
CREATE TABLE `placement_company_batch_placements` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `company_id` bigint NOT NULL,
  `drive_id` bigint unsigned NOT NULL,
  `batch` varchar(9) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `students_placed` int NOT NULL DEFAULT '0',
  `status` enum('0','1') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `company_id` (`company_id`),
  KEY `fk_batch_placements_drive` (`drive_id`),
  CONSTRAINT `fk_batch_placements_drive` FOREIGN KEY (`drive_id`) REFERENCES `placement_drive` (`id`) ON DELETE CASCADE,
  CONSTRAINT `placement_company_batch_placements_ibfk_1` FOREIGN KEY (`company_id`) REFERENCES `placement_company` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `placement_drive`;
CREATE TABLE `placement_drive` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `company_id` bigint NOT NULL,
  `job_role` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `placement_type` enum('Full-time Placement','Full-time Placment','Internship + PPO','Internship','Apprenticeship') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Full-time Placement',
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
  `batch_id` json DEFAULT NULL,
  `batch_ids` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_placement_drive_company` (`company_id`),
  KEY `idx_placement_drive_owner` (`drive_owner_user_id`),
  CONSTRAINT `fk_placement_drive_company` FOREIGN KEY (`company_id`) REFERENCES `placement_company` (`id`),
  CONSTRAINT `fk_placement_drive_owner` FOREIGN KEY (`drive_owner_user_id`) REFERENCES `master_users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `placement_drive_activity_log`;
CREATE TABLE `placement_drive_activity_log` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `drive_id` bigint unsigned NOT NULL,
  `user_id` bigint unsigned DEFAULT NULL,
  `activity_type` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `entity_type` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `entity_id` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `activity_description` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_placement_drive_activity_log_drive` (`drive_id`),
  KEY `idx_placement_drive_activity_log_user` (`user_id`),
  KEY `idx_dup_check` (`drive_id`,`user_id`,`activity_type`,`entity_type`,`entity_id`,`created_at`),
  CONSTRAINT `fk_placement_drive_activity_log_drive` FOREIGN KEY (`drive_id`) REFERENCES `placement_drive` (`id`),
  CONSTRAINT `fk_placement_drive_activity_log_user` FOREIGN KEY (`user_id`) REFERENCES `master_users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `placement_drive_eligibility`;
CREATE TABLE `placement_drive_eligibility` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `drive_id` bigint unsigned NOT NULL,
  `department_ids` json DEFAULT NULL,
  `min_cgpa` decimal(4,2) DEFAULT NULL,
  `min_tenth_mark` decimal(5,2) DEFAULT NULL,
  `min_twelfth_mark` decimal(5,2) DEFAULT NULL,
  `max_current_arrears` int DEFAULT NULL,
  `max_history_arrears` int DEFAULT NULL,
  `max_existing_offer_lpa` decimal(8,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_placement_drive_eligibility_drive` (`drive_id`),
  CONSTRAINT `fk_placement_drive_eligibility_drive` FOREIGN KEY (`drive_id`) REFERENCES `placement_drive` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `placement_drive_offers`;
CREATE TABLE `placement_drive_offers` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `drive_student_id` bigint unsigned NOT NULL,
  `final_role` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `package_lpa` decimal(8,2) DEFAULT NULL,
  `confirmed_at` datetime DEFAULT NULL,
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `offer_letter_file` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_placement_drive_offers_student` (`drive_student_id`),
  CONSTRAINT `fk_placement_drive_offers_student` FOREIGN KEY (`drive_student_id`) REFERENCES `placement_drive_students` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `placement_drive_stages`;
CREATE TABLE `placement_drive_stages` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `drive_id` bigint unsigned NOT NULL,
  `stage_name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `sequence_no` int NOT NULL,
  `scheduled_date` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `internal_notes` text COLLATE utf8mb4_general_ci,
  `stage_status` enum('pending','pending_date_not_announced','scheduled','in_progress','awaiting_result','completed') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'pending',
  PRIMARY KEY (`id`),
  KEY `idx_placement_drive_stages_drive` (`drive_id`),
  CONSTRAINT `fk_placement_drive_stages_drive` FOREIGN KEY (`drive_id`) REFERENCES `placement_drive` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `placement_drive_students`;
CREATE TABLE `placement_drive_students` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `drive_id` bigint unsigned NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `drive_status` enum('included','excluded','special_entry') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'included',
  `included_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  PRIMARY KEY (`id`),
  KEY `idx_placement_drive_students_drive` (`drive_id`),
  KEY `idx_placement_drive_students_user` (`user_id`),
  CONSTRAINT `fk_placement_drive_students_drive` FOREIGN KEY (`drive_id`) REFERENCES `placement_drive` (`id`),
  CONSTRAINT `fk_placement_drive_students_user` FOREIGN KEY (`user_id`) REFERENCES `master_users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `placement_drive_substages`;
CREATE TABLE `placement_drive_substages` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `stage_id` bigint unsigned NOT NULL,
  `substage_name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `sequence_no` int NOT NULL,
  `scheduled_date` datetime DEFAULT NULL,
  `substage_status` enum('pending','pending_date_not_announced','scheduled','in_progress','awaiting_result','completed') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'pending',
  `internal_notes` text COLLATE utf8mb4_general_ci,
  `completed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_placement_drive_substages_stage` (`stage_id`),
  CONSTRAINT `fk_placement_drive_substages_stage` FOREIGN KEY (`stage_id`) REFERENCES `placement_drive_stages` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `placement_review_notes`;
CREATE TABLE `placement_review_notes` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `note` text NOT NULL,
  `created_by` bigint unsigned NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_created_by` (`created_by`),
  CONSTRAINT `fk_review_note_creator` FOREIGN KEY (`created_by`) REFERENCES `master_users` (`id`),
  CONSTRAINT `fk_review_note_student` FOREIGN KEY (`user_id`) REFERENCES `master_users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


DROP TABLE IF EXISTS `placement_stage_results`;
CREATE TABLE `placement_stage_results` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `drive_student_id` bigint unsigned NOT NULL,
  `stage_id` bigint unsigned NOT NULL,
  `substage_id` bigint unsigned DEFAULT NULL,
  `previous_stage_status` enum('cleared','spl_entry') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'cleared',
  `outcome` enum('pending','cleared','not_cleared','absent','withdrawn') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'pending',
  `score` decimal(8,2) DEFAULT NULL,
  `remarks` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `updated_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_stage_results_drive_student` (`drive_student_id`),
  KEY `idx_stage_results_stage` (`stage_id`),
  KEY `idx_stage_results_substage` (`substage_id`),
  KEY `fk_stage_results_updated_by` (`updated_by`),
  CONSTRAINT `fk_stage_results_drive_student` FOREIGN KEY (`drive_student_id`) REFERENCES `placement_drive_students` (`id`),
  CONSTRAINT `fk_stage_results_stage` FOREIGN KEY (`stage_id`) REFERENCES `placement_drive_stages` (`id`),
  CONSTRAINT `fk_stage_results_substage` FOREIGN KEY (`substage_id`) REFERENCES `placement_drive_substages` (`id`),
  CONSTRAINT `fk_stage_results_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `master_users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `placement_student_basic_details`;
CREATE TABLE `placement_student_basic_details` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `school_percentage` decimal(5,2) DEFAULT NULL,
  `tenth_mark` decimal(6,2) DEFAULT NULL,
  `twelth_mark` decimal(6,2) DEFAULT NULL,
  `cgpa` decimal(4,2) DEFAULT NULL,
  `admission_quota` enum('MQ','GQ') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `nip` enum('0','1') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT '0',
  `ip` enum('0','1') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT '0',
  `current_arrear_count` int NOT NULL DEFAULT '0',
  `higher_studies` enum('0','1') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT '0',
  `startup` enum('0','1') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT '0',
  `business` enum('0','1') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT '0',
  `software_company` enum('0','1') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT '0',
  `core_company` enum('0','1') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT '0',
  `history_arrear_count` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_student_basic_user` (`user_id`),
  CONSTRAINT `fk_placement_student_basic_details_user` FOREIGN KEY (`user_id`) REFERENCES `master_users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `roles`;
CREATE TABLE `roles` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `role` varchar(50) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- 2026-11-04 11:01:44 UTC
