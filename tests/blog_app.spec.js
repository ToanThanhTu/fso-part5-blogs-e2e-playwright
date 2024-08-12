const { test, expect, beforeEach, describe } = require('@playwright/test')

// import helper for login and create blog
const { loginWith, createBlog } = require('./helper')

describe('Blog app', () => {
    beforeEach(async ({ page, request }) => {
        await request.post('/api/testing/reset')
        await request.post('/api/users', {
            data: {
                name: 'John Smith',
                username: 'john',
                password: 'smith'
            }
        })

        await page.goto('/')
    })

    test('Login form is shown', async ({ page }) => {
        await expect(page.getByText('log in to application')).toBeVisible()
        await expect(page.getByText('username')).toBeVisible()
        await expect(page.getByText('password')).toBeVisible()
    })

    describe('Login', () => {
        test('succeed with correct credentials', async ({ page }) => {
            await loginWith(page, 'john', 'smith')
            await expect(page.getByText('John Smith logged in')).toBeVisible()
        })

        test('fails with wrong credentials', async ({ page }) => {
            await loginWith(page, 'john', 'wrong')
            await expect(page.getByText('wrong username or password')).toBeVisible()
        })
    })

    describe('When logged in', () => {
        beforeEach(async ({ page }) => {
            await loginWith(page, 'john', 'smith')
        })

        test('a new blog can be created', async ({ page }) => {
            // create new blog
            await createBlog(
                page,
                'a blog created from playwright',
                'Playwright John',
                'https://test.playwright.john'
            )

            // wait for notification to disappear
            await page.waitForTimeout(3000)

            await expect(page.getByText('a blog created from playwright')).toBeVisible()
        })

        describe('and several blogs exist', () => {
            beforeEach(async ({ page }) => {
                // create 3 blogs
                await createBlog(
                    page,
                    'This is the first blog from playwright',
                    'Playwright John',
                    'https://test.playwright.john',
                    true
                )

                await createBlog(
                    page,
                    'This is the second blog from playwright',
                    'Smith Play',
                    'https://test.playwright.smith',
                    true
                )

                await createBlog(
                    page,
                    'This is the third blog from playwright',
                    'John Wright',
                    'https://test.john.playwright',
                    true
                )

                // wait for notification to disappear
                await page.waitForTimeout(3000)
            })

            test('a blog can be liked', async ({ page }) => {
                // click view to expand (second blog)
                await page.getByRole('button', { name: 'view' }).nth(1).click()

                // get the like button
                const likeButton = await page.getByRole('button', { name: 'like' })

                // click 3 times, wait for each time
                likeButton.click()
                await page.getByText('likes 1').last().waitFor()

                likeButton.click()
                await page.getByText('likes 2').last().waitFor()

                likeButton.click()

                // likes is 3
                await expect(page.getByText('likes 3')).toBeVisible()
            })

            test('user can delete their blog', async ({ page }) => {
                // click view to expand (second blog)
                await page.getByRole('button', { name: 'view' }).nth(1).click()

                // handle dialog: confirm
                page.on('dialog', async (dialog) => await dialog.accept())

                // click the remove button
                await page.getByRole('button', { name: 'remove' }).click()

                // wait for state update and component re-render after deletion
                // and notification to disappear
                await page.waitForTimeout(3000)

                await expect(page.getByText('This is the second blog from playwright')).not.toBeVisible()
            })

            test('another user cannot see the blog\'s delete button', async ({ page, request }) => {
                // log out
                await page.getByRole('button', { name: 'logout' }).click()

                // create and login with a new user
                await request.post('/api/users', {
                    data: {
                        name: 'Mike Denis',
                        username: 'mike',
                        password: 'denis'
                    }
                })

                await loginWith(page, 'mike', 'denis')

                // click view to expand (second blog)
                await page.getByRole('button', { name: 'view' }).nth(1).click()

                await expect(page.getByRole('button', { name: 'remove' })).not.toBeVisible()
            })

            test('blogs are sorted based on like, most likes first', async ({ page }) => {
                // click view to expand (second blog)
                await page.getByRole('button', { name: 'view' }).nth(1).click()

                // get the like button
                const likeButton = await page.getByRole('button', { name: 'like' })

                // click twice, wait for each time
                likeButton.click()
                await page.getByText('likes 1').waitFor()

                likeButton.click()
                await page.getByText('likes 2').waitFor()

                // click hide (second blog)
                await page.getByRole('button', { name: 'hide' }).click()

                // click view to expand (third blog)
                await page.getByRole('button', { name: 'view' }).nth(2).click()

                // click like once
                likeButton.click()
                await page.getByText('likes 1').waitFor()

                // get list of blogs likes
                const blogLikes = await page.$$eval('.blog', blogs => {
                    return blogs.map(blog => {
                        const likes = blog.querySelector('.likes').textContent;
                        return parseInt(likes, 10)
                    })
                })

                // check likes are in descending order
                for (let i = 0; i < blogLikes.length - 1; i++) {
                    expect(blogLikes[i]).toBeGreaterThanOrEqual(blogLikes[i + 1])
                }
            })
        })
    })
})