CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reports_target_user_unique" UNIQUE("target_type","target_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "route_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"route_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"body" text NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "route_likes" (
	"route_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "route_likes_route_id_user_id_pk" PRIMARY KEY("route_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "routes" ADD COLUMN "hidden" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "routes" ADD COLUMN "min_lat" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "routes" ADD COLUMN "min_lng" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "routes" ADD COLUMN "max_lat" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "routes" ADD COLUMN "max_lng" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "routes" ADD COLUMN "dist_m" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "routes" ADD COLUMN "gain_m" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "routes" ADD COLUMN "like_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "routes" ADD COLUMN "comment_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_comments" ADD CONSTRAINT "route_comments_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_comments" ADD CONSTRAINT "route_comments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_likes" ADD CONSTRAINT "route_likes_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_likes" ADD CONSTRAINT "route_likes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "route_comments_route_idx" ON "route_comments" USING btree ("route_id","created_at");--> statement-breakpoint
CREATE INDEX "routes_public_bbox_idx" ON "routes" USING btree ("shared","hidden","min_lat","max_lat");--> statement-breakpoint
-- 既存のルートの範囲・距離・獲得標高を，保存済みの座標と統計から埋める
UPDATE "routes" SET
	"min_lat" = (SELECT min((c->>'lat')::double precision) FROM jsonb_array_elements("coords") c),
	"max_lat" = (SELECT max((c->>'lat')::double precision) FROM jsonb_array_elements("coords") c),
	"min_lng" = (SELECT min((c->>'lng')::double precision) FROM jsonb_array_elements("coords") c),
	"max_lng" = (SELECT max((c->>'lng')::double precision) FROM jsonb_array_elements("coords") c),
	"dist_m" = ("stats"->>'dist')::double precision,
	"gain_m" = ("stats"->>'gain')::double precision;
