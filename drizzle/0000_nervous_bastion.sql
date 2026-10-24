CREATE TABLE "board_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"cover_image" text NOT NULL,
	"public_id" text NOT NULL,
	"position" jsonb NOT NULL,
	"keywords" text[] DEFAULT '{}' NOT NULL,
	"link" text,
	CONSTRAINT "board_images_title_unique" UNIQUE("title"),
	CONSTRAINT "board_images_public_id_unique" UNIQUE("public_id")
);
