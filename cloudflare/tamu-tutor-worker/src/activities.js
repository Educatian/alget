/**
 * Written activities, one per section, bundled into the worker so the reference answers never
 * reach the browser (the static preview's section JSON carries prompt and criteria only).
 */
import a0101 from '../../../frontend/content/ai-literacy/01/01.activity.json' with { type: 'json' }
import a0102 from '../../../frontend/content/ai-literacy/01/02.activity.json' with { type: 'json' }
import a0103 from '../../../frontend/content/ai-literacy/01/03.activity.json' with { type: 'json' }
import a0201 from '../../../frontend/content/ai-literacy/02/01.activity.json' with { type: 'json' }
import a0202 from '../../../frontend/content/ai-literacy/02/02.activity.json' with { type: 'json' }
import a0203 from '../../../frontend/content/ai-literacy/02/03.activity.json' with { type: 'json' }
import a0301 from '../../../frontend/content/ai-literacy/03/01.activity.json' with { type: 'json' }
import a0302 from '../../../frontend/content/ai-literacy/03/02.activity.json' with { type: 'json' }
import a0303 from '../../../frontend/content/ai-literacy/03/03.activity.json' with { type: 'json' }
import a0401 from '../../../frontend/content/ai-literacy/04/01.activity.json' with { type: 'json' }
import a0402 from '../../../frontend/content/ai-literacy/04/02.activity.json' with { type: 'json' }
import a0403 from '../../../frontend/content/ai-literacy/04/03.activity.json' with { type: 'json' }

export const ACTIVITIES = {
    'ai-literacy/01/01': a0101, 'ai-literacy/01/02': a0102, 'ai-literacy/01/03': a0103,
    'ai-literacy/02/01': a0201, 'ai-literacy/02/02': a0202, 'ai-literacy/02/03': a0203,
    'ai-literacy/03/01': a0301, 'ai-literacy/03/02': a0302, 'ai-literacy/03/03': a0303,
    'ai-literacy/04/01': a0401, 'ai-literacy/04/02': a0402, 'ai-literacy/04/03': a0403,
}
