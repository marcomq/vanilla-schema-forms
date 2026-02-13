import { describe, it, expect, beforeEach } from 'vitest';
import { init } from '../src/index';

describe('Event Handling', () => {
    let container: HTMLElement;

    beforeEach(() => {
        document.body.innerHTML = '<div id="form-container"></div>';
        container = document.getElementById('form-container') as HTMLElement;
    });

    it('should handle array of tuples (prefixItems) correctly', async () => {
        // Schema reproducing the structure of KafkaConfig.consumer_options
        const schema = {
            type: "object",
            properties: {
                consumer_options: {
                    type: ["array", "null"],
                    items: {
                        type: "array",
                        prefixItems: [
                            { type: "string" },
                            { type: "string" }
                        ]
                    }
                }
            }
        };

        await init('form-container', schema);

        // 1. Find the outer "Add Item" button
        const outerAddBtn = container.querySelector('button[data-id="root.consumer_options"]') as HTMLButtonElement;
        expect(outerAddBtn).toBeTruthy();

        // 2. Click it to add the inner array (the tuple container)
        outerAddBtn.click();

        // 3. Verify the inner array container exists
        const outerItemsContainer = document.getElementById('root.consumer_options-items');
        expect(outerItemsContainer?.children.length).toBe(1);

        // 4. Verify the inner array (tuple) is rendered with 2 items immediately
        const innerItemsContainer = document.getElementById('root.consumer_options.0-items');
        expect(innerItemsContainer?.children.length).toBe(2);

        // 5. Verify the inner "Add Item" button does NOT exist (fixed tuple)
        const innerAddBtn = container.querySelector('button[data-id="root.consumer_options.0"]');
        expect(innerAddBtn).toBeNull();
    });
});
