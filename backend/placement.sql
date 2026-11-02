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

INSERT INTO `batches` (`id`, `name`) VALUES
(1,	'2022-2026'),
(2,	'2023-2027'),
(3,	'2024-2028')
ON DUPLICATE KEY UPDATE `id` = VALUES(`id`), `name` = VALUES(`name`);

DROP TABLE IF EXISTS `departments`;
CREATE TABLE `departments` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `departments` (`id`, `name`) VALUES
(1,	'Computer Science and Engineering'),
(3,	'Electronics and Communication Engineering'),
(2,	'Information Technology'),
(4,	'Placement')
ON DUPLICATE KEY UPDATE `id` = VALUES(`id`), `name` = VALUES(`name`);

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

INSERT INTO `master_users` (`id`, `roll_no`, `name`, `email`, `department_id`, `role_id`, `batch_id`) VALUES
(1,	'CS101',	'Arun Kumar',	'arun@example.com',	1,	1,	1),
(2,	'CS102',	'Priya Sharma',	'priya@example.com',	1,	1,	1),
(3,	'IT101',	'Karthik Raj',	'karthik@example.com',	2,	1,	1),
(4,	'IT102',	'Divya S',	'divya@example.com',	2,	1,	1),
(5,	'EC101',	'Rahul M',	'rahul@example.com',	3,	1,	1),
(6,	'ADMIN101',	'Placement Officer',	'officer@example.com',	4,	3,	NULL),
(7,	'FC101',	'Ranjith',	'faculty@example.com',	4,	2,	NULL),
(8,	'CS201',	'Ananya Ramesh',	'ananya@example.com',	1,	1,	2),
(9,	'IT201',	'Vignesh K',	'vignesh@example.com',	2,	1,	2),
(10,	'EC201',	'Sneha Patel',	'sneha@example.com',	1,	1,	2),
(11,	'EC202',	'Harish Balaji',	'harish@example.com',	3,	1,	2),
(12,	'IT202',	'Meera Nair',	'meera@example.com',	2,	1,	2),
(13,	'CS301',	'Gowtham S',	'gowtham@example.com',	1,	1,	3),
(14,	'IT301',	'Keerthana R',	'keerthana@example.com',	2,	1,	3)
ON DUPLICATE KEY UPDATE `id` = VALUES(`id`), `roll_no` = VALUES(`roll_no`), `name` = VALUES(`name`), `email` = VALUES(`email`), `department_id` = VALUES(`department_id`), `role_id` = VALUES(`role_id`), `batch_id` = VALUES(`batch_id`);

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

INSERT INTO `placement_company` (`id`, `company_code`, `company_name`, `collaboration_type`, `contact_status`, `category`, `recruiting_quarter`, `employee_size`, `founded_year`, `spoc1_name`, `spoc1_email`, `spoc1_contact`, `spoc2_name`, `spoc2_email`, `spoc2_contact`, `created_at`, `updated_at`, `status`) VALUES
(1,	'TECH001',	'Zoho',	'ACTIVE',	'CONTACTED',	'PRODUCT',	'Q3',	'501-1000',	'2010',	'Suresh Kumar',	'suresh@technova.example',	'9876543210',	'Anita Rao',	'anita@technova.example',	'9876543211',	'2026-10-28 09:36:33',	'2026-10-28 09:36:33',	'1'),
(2,	'CORE001',	'Soliton',	'NEW',	'NOT_CONTACTED',	'NETWORKING',	'Q4',	'101-200',	'2015',	'Vijay Kumar',	'vijay@coresystems.example',	'9876543212',	NULL,	NULL,	NULL,	'2026-10-28 09:36:33',	'2026-10-28 09:36:33',	'1'),
(16,	'TECH002',	'TCS',	'NEW',	'CONTACTED',	'PRODUCT',	'Q3',	'101-200',	'2026',	'HR Contact',	'hr@tcs.example',	'9876543210',	'',	'',	'',	'2026-10-29 05:46:21',	'2026-10-29 06:33:22',	'1'),
(17,	'TECH003',	'Survey Sparrow',	'ACTIVE',	'CONTACTED',	'PRODUCT',	'Q1',	'51-100',	'2000',	'',	'',	'',	NULL,	NULL,	NULL,	'2026-10-29 09:25:38',	'2026-10-29 09:25:38',	'1'),
(18,	'TECH004',	'Presidio',	'ACTIVE',	'NOT_CONTACTED',	'PRODUCT',	'Q3',	'101-200',	'2005',	'',	'',	'',	NULL,	NULL,	NULL,	'2026-10-29 10:16:08',	'2026-10-29 10:16:08',	'1')
ON DUPLICATE KEY UPDATE `id` = VALUES(`id`), `company_code` = VALUES(`company_code`), `company_name` = VALUES(`company_name`), `collaboration_type` = VALUES(`collaboration_type`), `contact_status` = VALUES(`contact_status`), `category` = VALUES(`category`), `recruiting_quarter` = VALUES(`recruiting_quarter`), `employee_size` = VALUES(`employee_size`), `founded_year` = VALUES(`founded_year`), `spoc1_name` = VALUES(`spoc1_name`), `spoc1_email` = VALUES(`spoc1_email`), `spoc1_contact` = VALUES(`spoc1_contact`), `spoc2_name` = VALUES(`spoc2_name`), `spoc2_email` = VALUES(`spoc2_email`), `spoc2_contact` = VALUES(`spoc2_contact`), `created_at` = VALUES(`created_at`), `updated_at` = VALUES(`updated_at`), `status` = VALUES(`status`);

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

INSERT INTO `placement_drive` (`id`, `company_id`, `job_role`, `placement_type`, `package_lpa`, `drive_start_date`, `drive_end_date`, `drive_owner_user_id`, `job_description`, `overall_status`, `result_publication_date`, `result_reference`, `result_notes`, `created_at`, `updated_at`, `batch_id`, `batch_ids`) VALUES
(1,	18,	'Software Engineer',	'Full-time Placement',	12.00,	'2026-10-31',	NULL,	6,	'',	'awaiting_final_result',	NULL,	'',	'',	'2026-10-31 04:42:22',	'2026-10-31 04:47:43',	'[1]',	NULL)
ON DUPLICATE KEY UPDATE `id` = VALUES(`id`), `company_id` = VALUES(`company_id`), `job_role` = VALUES(`job_role`), `placement_type` = VALUES(`placement_type`), `package_lpa` = VALUES(`package_lpa`), `drive_start_date` = VALUES(`drive_start_date`), `drive_end_date` = VALUES(`drive_end_date`), `drive_owner_user_id` = VALUES(`drive_owner_user_id`), `job_description` = VALUES(`job_description`), `overall_status` = VALUES(`overall_status`), `result_publication_date` = VALUES(`result_publication_date`), `result_reference` = VALUES(`result_reference`), `result_notes` = VALUES(`result_notes`), `created_at` = VALUES(`created_at`), `updated_at` = VALUES(`updated_at`), `batch_id` = VALUES(`batch_id`), `batch_ids` = VALUES(`batch_ids`);

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

INSERT INTO `placement_drive_activity_log` (`id`, `drive_id`, `user_id`, `activity_type`, `entity_type`, `entity_id`, `activity_description`, `created_at`) VALUES
(1,	1,	6,	'DRIVE_CREATED',	'DRIVE',	'1',	'Created Software Engineer placement drive',	'2026-10-31 04:42:22'),
(2,	1,	6,	'ELIGIBILITY_CONFIGURED',	'ELIGIBILITY',	'1',	'Configured eligibility criteria (Open to All Students)',	'2026-10-31 04:42:29'),
(3,	1,	6,	'STUDENTS_EXCLUDED',	'ROSTER',	'1',	'1 students excluded from the drive',	'2026-10-31 04:42:38'),
(4,	1,	6,	'SPECIAL_ENTRY_ADDED',	'ROSTER',	'1',	'2 students added through special entry',	'2026-10-31 04:43:03'),
(5,	1,	6,	'STAGE_CREATED',	'STAGE',	'1',	'Created Online assesment stage',	'2026-10-31 04:43:36'),
(6,	1,	6,	'STAGE_CREATED',	'STAGE',	'2',	'Created Tech stage',	'2026-10-31 04:44:17'),
(7,	1,	6,	'STUDENTS_CLEARED',	'STAGE',	'1',	'1 students cleared Online assesment',	'2026-10-31 04:45:46'),
(8,	1,	6,	'STAGE_COMPLETED',	'STAGE',	'1',	'Online assesment stage marked as completed',	'2026-10-31 04:45:58'),
(9,	1,	6,	'STUDENTS_CLEARED',	'STAGE',	'2',	'1 students cleared Tech',	'2026-10-31 04:46:09'),
(10,	1,	6,	'SUBSTAGE_COMPLETED',	'SUBSTAGE',	'1',	'Coding round marked as completed',	'2026-10-31 04:46:17'),
(11,	1,	NULL,	'OFFER_LETTER_UPLOADED',	'STUDENT',	'6',	'Uploaded offer letter for CS201',	'2026-10-31 04:47:02'),
(12,	1,	6,	'RECRUITMENT_COMPLETED',	'DRIVE',	'1',	'All recruitment stages completed; moved to Final Selection',	'2026-10-31 04:47:43')
ON DUPLICATE KEY UPDATE `id` = VALUES(`id`), `drive_id` = VALUES(`drive_id`), `user_id` = VALUES(`user_id`), `activity_type` = VALUES(`activity_type`), `entity_type` = VALUES(`entity_type`), `entity_id` = VALUES(`entity_id`), `activity_description` = VALUES(`activity_description`), `created_at` = VALUES(`created_at`);

DROP TABLE IF EXISTS `placement_drive_eligibility`;
CREATE TABLE `placement_drive_eligibility` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `drive_id` bigint unsigned NOT NULL,
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

INSERT INTO `placement_drive_eligibility` (`id`, `drive_id`, `min_cgpa`, `min_tenth_mark`, `min_twelfth_mark`, `max_current_arrears`, `max_history_arrears`, `max_existing_offer_lpa`) VALUES
(1,	1,	NULL,	NULL,	NULL,	NULL,	NULL,	NULL)
ON DUPLICATE KEY UPDATE `id` = VALUES(`id`), `drive_id` = VALUES(`drive_id`), `min_cgpa` = VALUES(`min_cgpa`), `min_tenth_mark` = VALUES(`min_tenth_mark`), `min_twelfth_mark` = VALUES(`min_twelfth_mark`), `max_current_arrears` = VALUES(`max_current_arrears`), `max_history_arrears` = VALUES(`max_history_arrears`), `max_existing_offer_lpa` = VALUES(`max_existing_offer_lpa`);

DROP TABLE IF EXISTS `placement_drive_offers`;
CREATE TABLE `placement_drive_offers` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `drive_student_id` bigint unsigned NOT NULL,
  `final_role` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `package_lpa` decimal(8,2) DEFAULT NULL,
  `confirmed_at` datetime DEFAULT NULL,
  `result_reference` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `offer_letter_file` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_placement_drive_offers_student` (`drive_student_id`),
  CONSTRAINT `fk_placement_drive_offers_student` FOREIGN KEY (`drive_student_id`) REFERENCES `placement_drive_students` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `placement_drive_offers` (`id`, `drive_student_id`, `final_role`, `package_lpa`, `confirmed_at`, `result_reference`, `notes`, `offer_letter_file`, `created_at`) VALUES
(1,	6,	NULL,	NULL,	NULL,	'C:\\BIT\\placement\\placement_drive_management\\document_db\\student_offer_letters\\CS201_TECH004.pdf',	NULL,	'C:\\BIT\\placement\\placement_drive_management\\document_db\\student_offer_letters\\CS201_TECH004.pdf',	'2026-10-31 04:47:02')
ON DUPLICATE KEY UPDATE `id` = VALUES(`id`), `drive_student_id` = VALUES(`drive_student_id`), `final_role` = VALUES(`final_role`), `package_lpa` = VALUES(`package_lpa`), `confirmed_at` = VALUES(`confirmed_at`), `result_reference` = VALUES(`result_reference`), `notes` = VALUES(`notes`), `offer_letter_file` = VALUES(`offer_letter_file`), `created_at` = VALUES(`created_at`);

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

INSERT INTO `placement_drive_stages` (`id`, `drive_id`, `stage_name`, `sequence_no`, `scheduled_date`, `completed_at`, `internal_notes`, `stage_status`) VALUES
(1,	1,	'Online assesment',	1,	NULL,	'2026-10-31 10:17:43',	'',	'completed'),
(2,	1,	'Tech',	2,	'2026-01-31 05:30:00',	'2026-10-31 10:17:43',	'',	'completed')
ON DUPLICATE KEY UPDATE `id` = VALUES(`id`), `drive_id` = VALUES(`drive_id`), `stage_name` = VALUES(`stage_name`), `sequence_no` = VALUES(`sequence_no`), `scheduled_date` = VALUES(`scheduled_date`), `completed_at` = VALUES(`completed_at`), `internal_notes` = VALUES(`internal_notes`), `stage_status` = VALUES(`stage_status`);

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

INSERT INTO `placement_drive_students` (`id`, `drive_id`, `user_id`, `drive_status`, `included_at`, `notes`) VALUES
(1,	1,	1,	'excluded',	'2026-10-31 04:42:29',	'Automatically included based on eligibility criteria'),
(2,	1,	4,	'included',	'2026-10-31 04:42:29',	'Automatically included based on eligibility criteria'),
(3,	1,	3,	'included',	'2026-10-31 04:42:29',	'Automatically included based on eligibility criteria'),
(4,	1,	2,	'included',	'2026-10-31 04:42:29',	'Automatically included based on eligibility criteria'),
(5,	1,	5,	'included',	'2026-10-31 04:42:29',	'Automatically included based on eligibility criteria'),
(6,	1,	8,	'special_entry',	'2026-10-31 04:43:03',	''),
(7,	1,	13,	'special_entry',	'2026-10-31 04:43:03',	'')
ON DUPLICATE KEY UPDATE `id` = VALUES(`id`), `drive_id` = VALUES(`drive_id`), `user_id` = VALUES(`user_id`), `drive_status` = VALUES(`drive_status`), `included_at` = VALUES(`included_at`), `notes` = VALUES(`notes`);

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

INSERT INTO `placement_drive_substages` (`id`, `stage_id`, `substage_name`, `sequence_no`, `scheduled_date`, `substage_status`, `internal_notes`, `completed_at`) VALUES
(1,	2,	'Coding',	1,	NULL,	'completed',	'',	'2026-10-31 10:16:17'),
(2,	2,	'HR',	2,	NULL,	'completed',	'',	'2026-10-31 10:16:24')
ON DUPLICATE KEY UPDATE `id` = VALUES(`id`), `stage_id` = VALUES(`stage_id`), `substage_name` = VALUES(`substage_name`), `sequence_no` = VALUES(`sequence_no`), `scheduled_date` = VALUES(`scheduled_date`), `substage_status` = VALUES(`substage_status`), `internal_notes` = VALUES(`internal_notes`), `completed_at` = VALUES(`completed_at`);

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

INSERT INTO `placement_review_notes` (`id`, `user_id`, `note`, `created_by`, `created_at`, `updated_at`) VALUES
(6,	1,	'wdefqwdefdewqed',	6,	'2026-11-02 03:49:05',	'2026-11-02 03:49:26'),
(7,	1,	'wdefqwerwqw2e',	6,	'2026-11-02 03:49:08',	'2026-11-02 03:49:23')
ON DUPLICATE KEY UPDATE `id` = VALUES(`id`), `user_id` = VALUES(`user_id`), `note` = VALUES(`note`), `created_by` = VALUES(`created_by`), `created_at` = VALUES(`created_at`), `updated_at` = VALUES(`updated_at`);

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

INSERT INTO `placement_stage_results` (`id`, `drive_student_id`, `stage_id`, `substage_id`, `previous_stage_status`, `outcome`, `score`, `remarks`, `updated_by`, `created_at`, `updated_at`) VALUES
(1,	2,	1,	NULL,	'cleared',	'pending',	NULL,	'',	NULL,	'2026-10-31 04:43:36',	'2026-10-31 04:43:36'),
(2,	3,	1,	NULL,	'cleared',	'pending',	NULL,	'',	NULL,	'2026-10-31 04:43:36',	'2026-10-31 04:43:36'),
(3,	4,	1,	NULL,	'cleared',	'cleared',	NULL,	'',	6,	'2026-10-31 04:43:36',	'2026-10-31 04:45:49'),
(4,	5,	1,	NULL,	'cleared',	'pending',	NULL,	'',	NULL,	'2026-10-31 04:43:36',	'2026-10-31 04:43:36'),
(5,	6,	1,	NULL,	'cleared',	'cleared',	NULL,	'',	6,	'2026-10-31 04:43:36',	'2026-10-31 04:45:46'),
(6,	7,	1,	NULL,	'cleared',	'cleared',	NULL,	'',	6,	'2026-10-31 04:43:36',	'2026-10-31 04:45:47'),
(7,	4,	2,	1,	'cleared',	'pending',	NULL,	'',	6,	'2026-10-31 04:45:58',	'2026-10-31 04:45:58'),
(8,	6,	2,	1,	'cleared',	'cleared',	NULL,	'',	6,	'2026-10-31 04:45:58',	'2026-10-31 04:46:09'),
(9,	7,	2,	1,	'cleared',	'cleared',	NULL,	'',	6,	'2026-10-31 04:45:58',	'2026-10-31 04:46:11'),
(10,	6,	2,	2,	'cleared',	'cleared',	NULL,	'',	6,	'2026-10-31 04:46:17',	'2026-10-31 04:46:21'),
(11,	7,	2,	2,	'cleared',	'pending',	NULL,	'',	6,	'2026-10-31 04:46:17',	'2026-10-31 04:46:17')
ON DUPLICATE KEY UPDATE `id` = VALUES(`id`), `drive_student_id` = VALUES(`drive_student_id`), `stage_id` = VALUES(`stage_id`), `substage_id` = VALUES(`substage_id`), `previous_stage_status` = VALUES(`previous_stage_status`), `outcome` = VALUES(`outcome`), `score` = VALUES(`score`), `remarks` = VALUES(`remarks`), `updated_by` = VALUES(`updated_by`), `created_at` = VALUES(`created_at`), `updated_at` = VALUES(`updated_at`);

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

INSERT INTO `placement_student_basic_details` (`id`, `user_id`, `school_percentage`, `tenth_mark`, `twelth_mark`, `cgpa`, `admission_quota`, `nip`, `ip`, `current_arrear_count`, `higher_studies`, `startup`, `business`, `software_company`, `core_company`, `history_arrear_count`) VALUES
(1,	1,	92.50,	92.50,	88.00,	8.50,	'GQ',	'0',	'1',	0,	'0',	'0',	'0',	'1',	'0',	0),
(2,	2,	95.00,	95.00,	91.00,	9.10,	'GQ',	'0',	'1',	0,	'0',	'0',	'0',	'1',	'0',	0),
(3,	3,	85.00,	85.00,	82.00,	7.80,	'MQ',	'0',	'1',	1,	'0',	'0',	'0',	'1',	'0',	0),
(4,	4,	90.00,	90.00,	89.00,	8.70,	'GQ',	'0',	'1',	0,	'0',	'0',	'0',	'1',	'0',	0),
(5,	5,	88.00,	88.00,	84.00,	8.00,	'GQ',	'0',	'1',	0,	'0',	'0',	'0',	'0',	'1',	0),
(6,	8,	94.00,	94.00,	92.50,	8.90,	'GQ',	'0',	'1',	0,	'0',	'0',	'0',	'1',	'0',	0),
(7,	9,	82.00,	82.00,	80.00,	7.40,	'MQ',	'0',	'1',	1,	'0',	'0',	'0',	'1',	'0',	2),
(8,	10,	96.50,	96.50,	95.00,	9.40,	'GQ',	'0',	'1',	0,	'0',	'0',	'0',	'1',	'0',	0),
(9,	11,	75.00,	75.00,	72.00,	6.85,	'GQ',	'0',	'1',	2,	'0',	'0',	'0',	'0',	'1',	3),
(10,	12,	89.00,	89.00,	86.50,	8.15,	'GQ',	'0',	'1',	0,	'0',	'0',	'0',	'1',	'0',	0),
(11,	13,	91.00,	91.00,	88.00,	8.60,	'GQ',	'0',	'1',	0,	'0',	'0',	'0',	'1',	'0',	0),
(12,	14,	80.00,	80.00,	78.00,	7.10,	'MQ',	'0',	'1',	0,	'0',	'0',	'0',	'1',	'0',	1)
ON DUPLICATE KEY UPDATE `id` = VALUES(`id`), `user_id` = VALUES(`user_id`), `school_percentage` = VALUES(`school_percentage`), `tenth_mark` = VALUES(`tenth_mark`), `twelth_mark` = VALUES(`twelth_mark`), `cgpa` = VALUES(`cgpa`), `admission_quota` = VALUES(`admission_quota`), `nip` = VALUES(`nip`), `ip` = VALUES(`ip`), `current_arrear_count` = VALUES(`current_arrear_count`), `higher_studies` = VALUES(`higher_studies`), `startup` = VALUES(`startup`), `business` = VALUES(`business`), `software_company` = VALUES(`software_company`), `core_company` = VALUES(`core_company`), `history_arrear_count` = VALUES(`history_arrear_count`);

DROP TABLE IF EXISTS `roles`;
CREATE TABLE `roles` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `role` varchar(50) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `roles` (`id`, `role`) VALUES
(3,	'admin'),
(2,	'faculty'),
(1,	'student')
ON DUPLICATE KEY UPDATE `id` = VALUES(`id`), `role` = VALUES(`role`);

-- 2026-11-02 04:46:30 UTC
