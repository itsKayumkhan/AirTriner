-- Create function to update trainer stats
CREATE OR REPLACE FUNCTION public.update_trainer_stats()
RETURNS TRIGGER AS $$
DECLARE
    target_user_id UUID;
BEGIN
    -- Determine the user_id to update (reviewee_id in reviews table)
    IF (TG_OP = 'DELETE') THEN
        target_user_id := OLD.reviewee_id;
    ELSE
        target_user_id := NEW.reviewee_id;
    END IF;

    -- Update trainer_profiles
    UPDATE public.trainer_profiles
    SET 
        average_rating = (
            SELECT COALESCE(ROUND(AVG(rating)::numeric, 1), 0)
            FROM public.reviews
            WHERE reviewee_id = target_user_id
        ),
        total_reviews = (
            SELECT COUNT(*)
            FROM public.reviews
            WHERE reviewee_id = target_user_id
        )
    WHERE user_id = target_user_id;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS on_review_change ON public.reviews;
CREATE TRIGGER on_review_change
AFTER INSERT OR UPDATE OR DELETE ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_trainer_stats();

-- Initial sync for existing data
UPDATE public.trainer_profiles tp
SET 
    average_rating = (
        SELECT COALESCE(ROUND(AVG(rating)::numeric, 1), 0)
        FROM public.reviews
        WHERE reviewee_id = tp.user_id
    ),
    total_reviews = (
        SELECT COUNT(*)
        FROM public.reviews
        WHERE reviewee_id = tp.user_id
    );
